import mongoose from 'mongoose';

// Registers a model once per process and reuses it everywhere.
//
// In development the dev server can load a model file again (a hot reload,
// or another part of the app such as the job runner loading its own copy).
// Re-creating the model every time used to cut the job runner's copy off from
// the database (its queries waited forever), while keeping an old model after
// a field was added silently dropped that field. So the model is rebuilt only
// when its fields really changed; otherwise the existing one is reused.

const shape = (schema) => Object.entries(schema.paths)
  .map(([key, type]) => `${key}:${type.instance}${type.enumValues?.length ? `(${type.enumValues.join('|')})` : ''}`)
  .sort()
  .join(',');

export default function defineModel(name, schema) {
  const existing = mongoose.models[name];
  if (existing) {
    if (process.env.NODE_ENV === 'production' || shape(existing.schema) === shape(schema)) return existing;
    // Development only: the fields changed, so build the model again.
    mongoose.deleteModel(name);
  }
  return mongoose.model(name, schema);
}
