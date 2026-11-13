import mongoose from 'mongoose';
import { Readable } from 'node:stream';
import { FILE_TYPES, MAX_FILE_BYTES } from '@/data/orderStatus';
import { ValidationError } from './validate';

// Order files (articles, drafts, chat attachments, dispute evidence), kept in
// MongoDB GridFS so they live with the database and survive deploys. Each
// file records the order it belongs to and who uploaded it; only that
// order's buyer and seller, and admins, can download it.

const BUCKET = 'orderFiles';
const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET });

const extOf = (name) => (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
const cleanName = (name) => String(name || 'file').replace(/[\\/\0\r\n"]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'file';

export const KINDS = ['article', 'draft', 'chat', 'evidence'];

// Saves a File from request.formData(). Returns { fileId, name, size, type }.
export const saveOrderFile = async (file, { orderId, userId, kind }) => {
  if (!file || typeof file === 'string') throw new ValidationError('Choose a file to upload', 'file');
  const ext = extOf(file.name);
  const type = FILE_TYPES[ext];
  if (!type) {
    throw new ValidationError(`This file type isn't allowed. Use ${Object.keys(FILE_TYPES).join(', ')}.`, 'file');
  }
  if (!file.size) throw new ValidationError('The file is empty', 'file');
  if (file.size > MAX_FILE_BYTES) throw new ValidationError(`Files can be at most ${MAX_FILE_BYTES / 1024 / 1024} MB`, 'file');

  const name = cleanName(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const upload = bucket().openUploadStream(name, {
    metadata: { order: new mongoose.Types.ObjectId(orderId), uploader: new mongoose.Types.ObjectId(userId), kind, type, ext },
  });
  await new Promise((resolve, reject) => {
    Readable.from(buffer).pipe(upload).on('finish', resolve).on('error', reject);
  });
  return { fileId: upload.id, name, size: buffer.length, type };
};

// The stored file's details, or null.
export const findOrderFile = async (fileId) => {
  if (!mongoose.isValidObjectId(fileId)) return null;
  const [doc] = await bucket().find({ _id: new mongoose.Types.ObjectId(fileId) }).limit(1).toArray();
  return doc || null;
};

// Checks that a file id sent with an action was uploaded by this user for
// this order (so nobody can attach someone else's file), and returns the
// details to save on the order.
export const ownFile = async (fileId, { orderId, userId, kinds }) => {
  if (!fileId) return undefined;
  const doc = await findOrderFile(fileId);
  if (!doc || String(doc.metadata?.order) !== String(orderId) || String(doc.metadata?.uploader) !== String(userId)
    || (kinds && !kinds.includes(doc.metadata?.kind))) {
    throw new ValidationError('That file could not be found. Please upload it again.', 'file');
  }
  return { fileId: doc._id, name: doc.filename, size: doc.length, type: doc.metadata?.type };
};

export const openDownload = (fileId) => bucket().openDownloadStream(new mongoose.Types.ObjectId(fileId));
