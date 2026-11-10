// Seeds the site owner's admin account defined in src/server/owner.js.
//
//   npm run seed:admin
//
// The running site also does this on its own every 10 minutes, so this is
// only needed to create the account right away (for example on a fresh
// database). It reads MONGO_URI from .env.local / .env like the app does.
import nextEnv from '@next/env';
import mongoose from 'mongoose';
import { ensureOwnerAdmin, OWNER_EMAIL } from '../src/server/owner.js';

nextEnv.loadEnvConfig(process.cwd());

if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is not set. Add it to .env.local (development) or .env (server).');
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGO_URI);
  const result = await ensureOwnerAdmin(mongoose.connection.db.collection('users'));
  console.log(`${OWNER_EMAIL}: ${result}`);
} catch (error) {
  console.error('Seeding the admin failed:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
