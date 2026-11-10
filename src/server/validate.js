import mongoose from 'mongoose';

// Small input checkers for route handlers. Each returns the cleaned value or
// throws a ValidationError, which serverError() turns into a 400 response
// naming the field.
export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.field = field;
  }
}

const fail = (field, message) => {
  throw new ValidationError(message, field);
};

const isEmpty = (value) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

export const str = (value, field, label, { required = true, min = 0, max = 500 } = {}) => {
  if (isEmpty(value)) {
    if (required) fail(field, `${label} is required`);
    return undefined;
  }
  if (typeof value !== 'string' && typeof value !== 'number') fail(field, `${label} must be text`);
  const text = String(value).trim();
  if (text.length < min) fail(field, `${label} must be at least ${min} characters`);
  if (text.length > max) fail(field, `${label} must be at most ${max} characters`);
  return text;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const email = (value, field = 'email', { required = true } = {}) => {
  const text = str(value, field, 'Email', { required, max: 254 });
  if (text !== undefined && !EMAIL_RE.test(text)) fail(field, 'Please enter a valid email address');
  return text;
};

// An http(s) URL with a real-looking host. Missing scheme gets https://.
export const url = (value, field, label, { required = true } = {}) => {
  let text = str(value, field, label, { required, max: 2048 });
  if (text === undefined) return undefined;
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    fail(field, `${label} must be a valid URL`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname.includes('.')) {
    fail(field, `${label} must be a valid URL`);
  }
  return parsed.toString();
};

export const num = (value, field, label, { required = true, min, max, integer = false } = {}) => {
  if (isEmpty(value)) {
    if (required) fail(field, `${label} is required`);
    return undefined;
  }
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
  if (!Number.isFinite(n)) fail(field, `${label} must be a number`);
  if (integer && !Number.isInteger(n)) fail(field, `${label} must be a whole number`);
  if (min !== undefined && n < min) fail(field, `${label} must be at least ${min}`);
  if (max !== undefined && n > max) fail(field, `${label} must be at most ${max}`);
  return n;
};

export const oneOf = (value, field, label, options, { required = true } = {}) => {
  if (isEmpty(value)) {
    if (required) fail(field, `${label} is required`);
    return undefined;
  }
  if (!options.includes(value)) fail(field, `${label} must be one of: ${options.join(', ')}`);
  return value;
};

export const bool = (value, field, label, { required = false } = {}) => {
  if (value === undefined || value === null) {
    if (required) fail(field, `${label} is required`);
    return undefined;
  }
  if (typeof value !== 'boolean') fail(field, `${label} must be true or false`);
  return value;
};

export const objectId = (value, field, label = 'Id') => {
  if (!mongoose.isValidObjectId(value)) fail(field, `${label} is not valid`);
  return String(value);
};
