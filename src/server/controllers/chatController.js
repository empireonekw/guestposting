import mongoose from 'mongoose';
import Conversation from '../models/Conversation';
import ChatMessage from '../models/ChatMessage';
import Listing from '../models/Listing';
import User from '../models/User';
import Notification from '../models/Notification';
import { json, readBody, serverError, queryParams, getPaging, pageInfo } from '../http';
import { str, objectId, oneOf, ValidationError } from '../validate';
import { rateLimit } from '../rateLimit';

// Chats:
//   - a buyer messages a seller about a website ("direct");
//   - any user asks the LetRank team for help ("support"), and an admin can
//     open a support chat with any user;
//   - admins can read every conversation, and answer support chats.

const isAdmin = (user) => user.role === 'admin';
const ids = (list) => list.map((x) => String(x?._id || x));
const isParticipant = (conv, user) => ids(conv.participants).includes(user.id);

const canRead = (conv, user) => isAdmin(user) || isParticipant(conv, user);
// Admins write into support chats as the team; direct chats belong to the
// two people in them (admins can only read those).
const canWrite = (conv, user) => (conv.kind === 'support' ? isParticipant(conv, user) || isAdmin(user) : isParticipant(conv, user));

const readAtFor = (conv, user) => conv.reads?.find((r) => String(r.user) === user.id)?.at;

// Has `user` got something new to read in this conversation?
const isUnread = (conv, user) => {
  const last = conv.lastMessage;
  if (!last?.sender) return false;
  if (isParticipant(conv, user)) {
    if (String(last.sender) === user.id) return false;
    const at = readAtFor(conv, user);
    return !at || conv.lastMessageAt > at;
  }
  // An admin looking at a support chat: new if the user wrote last.
  if (isAdmin(user) && conv.kind === 'support') {
    return !last.fromTeam && (!conv.teamReadAt || conv.lastMessageAt > conv.teamReadAt);
  }
  return false;
};

// What a conversation looks like in the inbox list.
const summary = (conv, user) => {
  const others = conv.participants.filter((p) => String(p._id) !== user.id);
  const title = conv.kind === 'support'
    ? (isParticipant(conv, user) ? 'LetRank support' : `${conv.participants[0]?.name || 'User'} (support)`)
    : (isParticipant(conv, user) ? others[0]?.name : conv.participants.map((p) => p.name).join(' ↔ ')) || 'Conversation';
  return {
    _id: conv._id,
    kind: conv.kind,
    status: conv.status,
    title,
    subject: conv.subject || (conv.listing?.domain ? `About ${conv.listing.domain}` : ''),
    listing: conv.listing ? { _id: conv.listing._id, domain: conv.listing.domain } : null,
    participants: conv.participants.map((p) => ({ _id: p._id, name: p.name, role: p.role })),
    lastMessage: conv.lastMessage?.body || '',
    lastFromTeam: !!conv.lastMessage?.fromTeam,
    lastMessageAt: conv.lastMessageAt,
    unread: isUnread(conv, user),
    // Support chats where the user wrote last and the team hasn't answered.
    waitingForTeam: conv.kind === 'support' && conv.status === 'open' && !!conv.lastMessage?.sender && !conv.lastMessage?.fromTeam,
    canWrite: canWrite(conv, user),
    readOnly: !canWrite(conv, user),
  };
};

const populateConv = (q) => q.populate('participants', 'name role').populate('listing', 'domain url');

// Tell the other side, once per conversation until they read it.
const notify = async (recipients, sender, message, convId) => {
  const link = `/messages?c=${convId}`;
  const already = await Notification.find({ recipient: { $in: recipients }, link, isRead: false }).distinct('recipient');
  const todo = recipients.filter((r) => !ids(already).includes(String(r)));
  if (todo.length) {
    await Notification.insertMany(todo.map((r) => ({ recipient: r, sender, type: 'message', message, link })));
  }
};

const activeAdmins = () => User.find({ role: 'admin', isSuspended: { $ne: true } }).distinct('_id');

const addMessage = async (conv, user, body) => {
  const fromTeam = isAdmin(user) && !isParticipant(conv, user);
  const msg = await ChatMessage.create({ conversation: conv._id, sender: user.id, fromTeam, body });
  conv.lastMessageAt = msg.createdAt;
  conv.lastMessage = { body: body.slice(0, 200), sender: user.id, fromTeam };
  // A user writing again reopens their support chat.
  if (conv.kind === 'support' && !fromTeam && conv.status === 'closed') conv.status = 'open';
  if (fromTeam) conv.teamReadAt = msg.createdAt;
  else {
    conv.reads = (conv.reads || []).filter((r) => String(r.user) !== user.id);
    conv.reads.push({ user: user.id, at: msg.createdAt });
  }
  await conv.save();

  const preview = body.length > 80 ? `${body.slice(0, 80)}…` : body;
  if (conv.kind === 'support') {
    if (fromTeam) await notify(ids(conv.participants), user.id, `LetRank support: ${preview}`, conv._id);
    else await notify(ids(await activeAdmins()), user.id, `Support message from ${user.name}: ${preview}`, conv._id);
  } else {
    await notify(ids(conv.participants).filter((p) => p !== user.id), user.id, `${user.name}: ${preview}`, conv._id);
  }
  return msg;
};

const messageView = (m, viewer) => ({
  _id: m._id,
  body: m.body,
  createdAt: m.createdAt,
  fromTeam: m.fromTeam,
  mine: String(m.sender?._id || m.sender) === viewer.id,
  sender: m.fromTeam ? { name: 'LetRank support', staff: m.sender?.name } : { _id: m.sender?._id, name: m.sender?.name },
});

const bodyField = (body) => str(body, 'body', 'Message', { min: 1, max: 2000 });

const limited = (user) => rateLimit('chat', user.id, { limit: 40, windowMs: 5 * 60 * 1000 });

// GET /api/conversations?box=mine|support|all&status=open|closed|all&page=1
export const listConversations = async (request, params, user) => {
  try {
    const q = queryParams(request);
    const box = oneOf(q.box, 'box', 'Box', ['mine', 'support', 'all'], { required: false }) || 'mine';
    const status = oneOf(q.status, 'status', 'Status', ['open', 'closed', 'all'], { required: false }) || 'all';
    if (box !== 'mine' && !isAdmin(user)) return json({ message: 'Not authorized' }, 403);
    const paging = getPaging(request, { defaultLimit: 30, maxLimit: 100 });

    const query = box === 'mine'
      ? { participants: new mongoose.Types.ObjectId(user.id) }
      : box === 'support' ? { kind: 'support' } : {};
    if (status !== 'all') query.status = status;

    const [rows, total] = await Promise.all([
      populateConv(Conversation.find(query)).sort({ lastMessageAt: -1 }).skip(paging.skip).limit(paging.limit),
      Conversation.countDocuments(query),
    ]);
    return json({ conversations: rows.map((c) => summary(c, user)), ...pageInfo(total, paging) });
  } catch (error) {
    return serverError(error);
  }
};

// GET /api/conversations/unread: counts for the sidebar badge.
export const unreadCounts = async (request, params, user) => {
  try {
    const mine = await Conversation.find({ participants: new mongoose.Types.ObjectId(user.id), 'lastMessage.sender': { $ne: null } })
      .select('participants lastMessage lastMessageAt reads kind teamReadAt')
      .sort({ lastMessageAt: -1 })
      .limit(200);
    const unread = mine.filter((c) => isUnread(c, user)).length;
    const supportWaiting = isAdmin(user)
      ? await Conversation.countDocuments({ kind: 'support', status: 'open', 'lastMessage.fromTeam': false, 'lastMessage.sender': { $ne: null } })
      : 0;
    return json({ unread, supportWaiting });
  } catch (error) {
    return serverError(error);
  }
};

// POST /api/conversations
//   { kind: 'support', subject, body }            a user asks the team
//   { kind: 'support', userId, subject, body }    an admin contacts a user
//   { kind: 'direct', listingId, body }           message a website's seller
export const startConversation = async (request, params, user) => {
  try {
    const stop = limited(user);
    if (stop) return stop;
    const input = await readBody(request);
    const kind = oneOf(input.kind, 'kind', 'Kind', ['direct', 'support']);
    const body = bodyField(input.body);

    let conv;
    if (kind === 'support') {
      const subject = str(input.subject, 'subject', 'Subject', { min: 3, max: 120 });
      let owner = user.id;
      if (input.userId) {
        if (!isAdmin(user)) return json({ message: 'Not authorized' }, 403);
        owner = objectId(input.userId, 'userId', 'User');
        if (!(await User.exists({ _id: owner }))) return json({ message: 'User not found' }, 404);
      }
      conv = await Conversation.create({ kind, participants: [owner], subject });
    } else {
      const listingId = objectId(input.listingId, 'listingId', 'Website');
      const listing = await Listing.findOne({ _id: listingId, isDeleted: { $ne: true } }).select('seller domain');
      if (!listing) return json({ message: 'Website not found' }, 404);
      if (String(listing.seller) === user.id) throw new ValidationError("You can't message yourself", 'listingId');
      const pair = [new mongoose.Types.ObjectId(user.id), listing.seller];
      conv = await Conversation.findOne({ kind: 'direct', listing: listing._id, participants: { $all: pair, $size: 2 } });
      if (!conv) conv = await Conversation.create({ kind, participants: pair, listing: listing._id });
    }

    await addMessage(conv, user, body);
    return json({ _id: conv._id }, 201);
  } catch (error) {
    return serverError(error);
  }
};

// GET /api/conversations/:id?after=<ISO date>: the thread (or only newer
// messages, for polling). Opening it marks it read.
export const getConversation = async (request, params, user) => {
  try {
    const id = objectId(params.id, 'id', 'Conversation');
    const conv = await populateConv(Conversation.findById(id));
    if (!conv || !canRead(conv, user)) return json({ message: 'Conversation not found' }, 404);

    const q = queryParams(request);
    const after = q.after ? new Date(q.after) : null;
    const filter = { conversation: conv._id };
    let messages;
    if (after && !Number.isNaN(after.getTime())) {
      messages = await ChatMessage.find({ ...filter, createdAt: { $gt: after } }).sort({ createdAt: 1 }).limit(200).populate('sender', 'name');
    } else {
      messages = (await ChatMessage.find(filter).sort({ createdAt: -1 }).limit(200).populate('sender', 'name')).reverse();
    }

    // Mark read.
    const now = new Date();
    if (isParticipant(conv, user)) {
      await Conversation.updateOne({ _id: conv._id }, { $pull: { reads: { user: new mongoose.Types.ObjectId(user.id) } } });
      await Conversation.updateOne({ _id: conv._id }, { $push: { reads: { user: user.id, at: now } } });
    } else if (isAdmin(user) && conv.kind === 'support') {
      await Conversation.updateOne({ _id: conv._id }, { $set: { teamReadAt: now } });
    }
    await Notification.updateMany({ recipient: user.id, link: `/messages?c=${conv._id}`, isRead: false }, { $set: { isRead: true } });

    return json({ conversation: summary(conv, user), messages: messages.map((m) => messageView(m, user)) });
  } catch (error) {
    return serverError(error);
  }
};

// POST /api/conversations/:id { body }: send a message.
export const sendChatMessage = async (request, params, user) => {
  try {
    const stop = limited(user);
    if (stop) return stop;
    const id = objectId(params.id, 'id', 'Conversation');
    const body = bodyField((await readBody(request)).body);
    const conv = await Conversation.findById(id);
    if (!conv || !canRead(conv, user)) return json({ message: 'Conversation not found' }, 404);
    if (!canWrite(conv, user)) return json({ message: 'Admins can read this chat but not write in it.' }, 403);
    const msg = await addMessage(conv, user, body);
    await msg.populate('sender', 'name');
    return json(messageView(msg, user), 201);
  } catch (error) {
    return serverError(error);
  }
};

// PATCH /api/conversations/:id { status: 'open' | 'closed' }: support chats.
export const setConversationStatus = async (request, params, user) => {
  try {
    const id = objectId(params.id, 'id', 'Conversation');
    const status = oneOf((await readBody(request)).status, 'status', 'Status', ['open', 'closed']);
    const conv = await Conversation.findById(id);
    if (!conv || !canRead(conv, user)) return json({ message: 'Conversation not found' }, 404);
    if (conv.kind !== 'support') return json({ message: 'Only support chats can be closed.' }, 400);
    if (!isAdmin(user) && !isParticipant(conv, user)) return json({ message: 'Not authorized' }, 403);
    conv.status = status;
    await conv.save();
    return json({ status });
  } catch (error) {
    return serverError(error);
  }
};
