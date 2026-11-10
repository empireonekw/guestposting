import mongoose from 'mongoose';

// Register every model up front so populate() works from any route,
// the same way the Express server had them all loaded at startup.
import './models/User';
import './models/Listing';
import './models/Order';
import './models/Message';
import './models/Notification';
import './models/Review';
import './models/ActivityLog';
import './models/JobRun';

// One connection per server process, shared across route handlers and
// survives dev hot reloads.
const cache = globalThis.__mongoose || (globalThis.__mongoose = { promise: null });

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set. Add it to .env.local (development) or .env (server) and restart.');
  }
  if (!cache.promise) {
    cache.promise = mongoose
      .connect(process.env.MONGO_URI)
      .then((conn) => {
        console.log('MongoDB Successfully Connected');
        return conn;
      })
      .catch((error) => {
        cache.promise = null;
        console.error(`Error: ${error.message}`);
        throw error;
      });
  }
  return cache.promise;
};

export default connectDB;
