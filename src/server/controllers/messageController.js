import Message from '../models/Message';
import Order from '../models/Order';
import Notification from '../models/Notification';
import User from '../models/User';
import { sendEmailInBackground } from '../sendEmail';
import { escapeHtml } from '../escape';
import { json, readBody, serverError } from '../http';
import { str, objectId } from '../validate';
import { rateLimit, MINUTE } from '../rateLimit';
import BRAND from '@/data/brand';

// Only the order's buyer and seller may read or write its chat.
const isParticipant = (order, user) =>
  order.buyer.toString() === user.id || order.seller.toString() === user.id;

export const sendMessage = async (request, params, user) => {
  try {
    const limited = rateLimit('message', user.id, { limit: 30, windowMs: MINUTE });
    if (limited) return limited;

    const body = await readBody(request);
    const orderId = objectId(body.orderId, 'orderId', 'Order');
    const text = str(body.text, 'text', 'Message', { max: 5000 });

    const order = await Order.findById(orderId).populate('listing', 'url');
    if (!order) return json({ message: 'Order not found' }, 404);
    if (!isParticipant(order, user)) return json({ message: 'Not authorized' }, 403);

    const message = await Message.create({ order: orderId, sender: user.id, text });
    const populatedMessage = await message.populate('sender', 'name role');

    const recipientId = order.buyer.toString() === user.id ? order.seller : order.buyer;
    const recipient = await User.findById(recipientId);

    await Notification.create({
      recipient: recipientId,
      sender: user.id,
      type: 'message',
      message: `New message from ${user.name} regarding ${order.listing.url}`,
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
          <p>You have received a new message from <strong>${escapeHtml(user.name)}</strong> regarding your guest post order on <strong>${escapeHtml(order.listing.url)}</strong>.</p>
          <blockquote style="background: #f9f9f9; padding: 15px; border-left: 5px solid #2563eb; white-space: pre-wrap;">${escapeHtml(text)}</blockquote>
          <a href="${escapeHtml(process.env.FRONTEND_URL)}/orders/${orderId}"
             style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px;">
             Reply on ${BRAND.name}
          </a>
        </div>
      `,
    }, 'Message email');

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
    if (!isParticipant(order, user)) return json({ message: 'Not authorized' }, 403);

    const messages = await Message.find({ order: orderId })
      .populate('sender', 'name role')
      .sort({ createdAt: 1 });
    return json(messages);
  } catch (error) {
    return serverError(error);
  }
};
