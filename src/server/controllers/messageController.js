import Message from '../models/Message';
import Order from '../models/Order';
import Notification from '../models/Notification';
import User from '../models/User';
import { sendEmailInBackground } from '../sendEmail';
import { escapeHtml } from '../escape';
import { json, readBody, serverError } from '../http';
import { str, objectId, ValidationError } from '../validate';
import { ownFile } from '../files';
import { rateLimit, MINUTE } from '../rateLimit';
import BRAND from '@/data/brand';

// The order's buyer and seller use its chat; admins can read it and answer
// as our support team (for disputes and stuck orders).
const isParticipant = (order, user) =>
  order.buyer.toString() === user.id || order.seller.toString() === user.id;
const canUse = (order, user) => isParticipant(order, user) || user.role === 'admin';
const MAX_ATTACHMENTS = 3;

export const sendMessage = async (request, params, user) => {
  try {
    const limited = rateLimit('message', user.id, { limit: 30, windowMs: MINUTE });
    if (limited) return limited;

    const body = await readBody(request);
    const orderId = objectId(body.orderId, 'orderId', 'Order');
    const text = str(body.text, 'text', 'Message', { required: false, max: 5000 }) || '';

    const order = await Order.findById(orderId).populate('listing', 'url');
    if (!order) return json({ message: 'Order not found' }, 404);
    if (!canUse(order, user)) return json({ message: 'Not authorized' }, 403);

    const ids = Array.isArray(body.fileIds) ? body.fileIds.slice(0, MAX_ATTACHMENTS + 1) : [];
    if (ids.length > MAX_ATTACHMENTS) throw new ValidationError(`Attach at most ${MAX_ATTACHMENTS} files`, 'fileIds');
    const attachments = [];
    for (const fileId of ids) {
      // eslint-disable-next-line no-await-in-loop
      attachments.push(await ownFile(fileId, { orderId, userId: user.id, kinds: ['chat'] }));
    }
    if (!text && !attachments.length) throw new ValidationError('Write a message or attach a file', 'text');

    const fromTeam = !isParticipant(order, user);
    const message = await Message.create({ order: orderId, sender: user.id, text, attachments, fromTeam });
    const populatedMessage = await message.populate('sender', 'name role');
    await Order.updateOne({ _id: orderId }, { $set: { lastActivityAt: new Date() } });

    const recipientIds = fromTeam ? [order.buyer, order.seller] : [order.buyer.toString() === user.id ? order.seller : order.buyer];
    const senderName = fromTeam ? BRAND.supportName : user.name;
    const preview = text || `${attachments.length} file${attachments.length === 1 ? '' : 's'}`;

    for (const recipientId of recipientIds) {
      // eslint-disable-next-line no-await-in-loop
      const recipient = await User.findById(recipientId);
      // eslint-disable-next-line no-await-in-loop
      await Notification.create({
        recipient: recipientId,
        sender: user.id,
        type: 'message',
        message: `New message from ${senderName} regarding ${order.listing.url}`,
        link: `/orders/${orderId}`,
        isRead: false,
      });
      if (recipient?.email) sendEmailInBackground({
      email: recipient.email,
      subject: `New message on ${BRAND.name}: ${order.listing.url}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #2563eb;">New Message Received</h2>
          <p>Hi <strong>${escapeHtml(recipient.name)}</strong>,</p>
          <p>You have received a new message from <strong>${escapeHtml(senderName)}</strong> regarding your guest post order on <strong>${escapeHtml(order.listing.url)}</strong>.</p>
          <blockquote style="background: #f9f9f9; padding: 15px; border-left: 5px solid #2563eb; white-space: pre-wrap;">${escapeHtml(preview)}</blockquote>
          <a href="${escapeHtml(process.env.FRONTEND_URL)}/orders/${orderId}"
             style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px;">
             Reply on ${BRAND.name}
          </a>
        </div>
      `,
      }, 'Message email');
    }

    return json(populatedMessage, 201);
  } catch (error) {
    return serverError(error);
  }
};

export const getOrderMessages = async (request, params, user) => {
  try {
    const orderId = objectId(params.orderId, 'orderId', 'Order');
    const order = await Order.findById(orderId).select('buyer seller');
    if (!order) return json({ message: 'Order not found' }, 404);
    if (!canUse(order, user)) return json({ message: 'Not authorized' }, 403);

    const messages = await Message.find({ order: orderId })
      .populate('sender', 'name role')
      .sort({ createdAt: 1 });
    return json(messages);
  } catch (error) {
    return serverError(error);
  }
};
