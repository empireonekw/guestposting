import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import connectDB from './db';
import { ValidationError } from './validate';
import { recordRequest, groupOf } from './telemetry';

export const json = (data, status = 200) => NextResponse.json(data, { status });

// Mirrors express.json(): a JSON body is parsed and anything else gives an
// empty object, so handlers can always destructure it. Malformed JSON, or a
// body that is not a JSON object, is a 400.
export class BadJsonError extends Error {}

export const readBody = async (request) => {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) return {};
  const text = await request.text();
  if (!text) return {};
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new BadJsonError('Invalid JSON body');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadJsonError('Request body must be a JSON object');
  }
  return body;
};

// The one place an unexpected error becomes a response. Bad input becomes a
// 400 with a readable message; anything else is logged and the client gets a
// generic 500, so database and stack details never leak to the browser.
export const serverError = (error) => {
  if (error instanceof ValidationError) {
    return json({ message: error.message, field: error.field }, 400);
  }
  if (error instanceof BadJsonError) return json({ message: error.message }, 400);
  if (error instanceof mongoose.Error.CastError) return json({ message: 'Invalid id' }, 400);
  if (error instanceof mongoose.Error.ValidationError) {
    const first = Object.values(error.errors)[0];
    return json({ message: first?.message || 'Invalid data' }, 400);
  }
  if (error?.code === 11000) return json({ message: 'This record already exists' }, 409);
  console.error(error);
  const res = json({ message: 'Something went wrong. Please try again.' }, 500);
  // The real reason, for the admin Code flow page only (never sent to users).
  res.lrError = error?.message || String(error);
  return res;
};

// Wraps a route handler: connects to Mongo first and turns anything that
// escapes the handler into a JSON error response (Express's error fallback).
export const route = (handler) => async (request, context) => {
  const started = performance.now();
  let res;
  try {
    await connectDB();
    const params = context?.params ? await context.params : {};
    res = await handler(request, params);
  } catch (error) {
    res = serverError(error);
  }
  // Timing and errors for the admin Code flow page.
  const { pathname } = new URL(request.url);
  recordRequest(groupOf(pathname), { ms: performance.now() - started, status: res?.status || 500, path: pathname, message: res?.lrError });
  return res;
};

export const queryParams = (request) => Object.fromEntries(new URL(request.url).searchParams);

// ?page=2&limit=25 -> { page, limit, skip }. Limits are capped so one request
// can never ask for the whole collection.
export const getPaging = (request, { defaultLimit = 25, maxLimit = 100 } = {}) => {
  const q = new URL(request.url).searchParams;
  const page = Math.max(1, parseInt(q.get('page'), 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(q.get('limit'), 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

export const pageInfo = (total, { page, limit }) => ({
  total,
  page,
  limit,
  pages: Math.max(1, Math.ceil(total / limit)),
});

// User text placed inside a regex query must match literally.
export const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
