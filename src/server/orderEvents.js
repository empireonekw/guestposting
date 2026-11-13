import User from './models/User';
import Notification from './models/Notification';
import { sendEmailInBackground } from './sendEmail';
import { escapeHtml } from './escape';
import BRAND from '@/data/brand';

// Telling buyers, sellers and our team about an order, and keeping its
// history list. Shared by the order workflow, link monitoring and the jobs.

const idOf = (x) => String(x?._id || x || '');

const orderLink = (order) => `/orders/${order._id}`;
export const site = (order) => order.site?.domain || 'your order';

const activeAdmins = () => User.find({ role: 'admin', isSuspended: { $ne: true } }).select('name email');

// Sends an in-app notification and an email to `to` (buyer, seller, admins).
export const notify = async (order, to, message, { emailSubject, from } = {}) => {
  const people = [];
  const load = async (id) => (id && id.email !== undefined ? id : User.findById(idOf(id)).select('name email'));
  if (to.includes('buyer')) people.push(await load(order.buyer));
  if (to.includes('seller')) people.push(await load(order.seller));
  if (to.includes('admins')) people.push(...(await activeAdmins()));
  const recipients = people.filter(Boolean).filter((p, i, all) => all.findIndex((q) => idOf(q) === idOf(p)) === i);
  if (!recipients.length) return;

  await Notification.insertMany(recipients.map((p) => ({
    recipient: p._id,
    sender: from || undefined,
    type: 'order_update',
    message: message.slice(0, 500),
    link: orderLink(order),
  })));

  const base = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  recipients.forEach((p) => {
    if (!p.email) return;
    sendEmailInBackground({
      email: p.email,
      subject: emailSubject || `Order update: ${site(order)}`,
      html: `<div style="font-family:sans-serif;max-width:560px">
        <p>Hi ${escapeHtml(p.name || '')},</p>
        <p>${escapeHtml(message)}</p>
        <p><a href="${escapeHtml(base)}${orderLink(order)}" style="display:inline-block;background:#5A3B8C;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Open the order</a></p>
        <p style="color:#858099;font-size:13px">${escapeHtml(BRAND.name)}</p>
      </div>`,
    }, 'Order email');
  });
};

export const addEvent = (order, { by, role, type, note }) => {
  order.events.push({ at: new Date(), by: by || undefined, role, type, note });
  order.lastActivityAt = new Date();
};

