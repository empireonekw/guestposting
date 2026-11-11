// The site owner's admin account, seeded from code.
//
// - Created automatically if it doesn't exist (scheduled job, every 10 min,
//   and `npm run seed:admin`).
// - Always kept as an active admin: no admin can change its role or suspend
//   it, and if someone edits the database directly the job puts it back.
//
// Only a bcrypt hash of the password is stored here, never the password
// itself, so the repository can't reveal it. To change the owner password,
// use "Forgot password" on the site (the hash below is only used when the
// account is first created), or replace the hash with a new one made by
//   node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" 'NEW-PASSWORD'
//
// This file has no imports so scripts/seed-admin.mjs can load it directly.

export const OWNER_EMAIL = 'letsrank69@gmail.com';
export const OWNER_NAME = 'Guest Posting Admin';
export const OWNER_PASSWORD_HASH = '$2b$12$E4Nco9DrL9lIDWGtwKVmXOoldbOJW2.ksBmQklA96zS6pHEobqJd.';

export const isOwnerEmail = (email) => String(email || '').trim().toLowerCase() === OWNER_EMAIL;

const CASE_INSENSITIVE = { locale: 'en', strength: 2 };

// Makes sure the owner account exists and is an active admin. `users` is the
// raw MongoDB users collection. Returns what it did, for logs.
export const ensureOwnerAdmin = async (users) => {
  const now = new Date();
  const existing = await users.findOne({ email: OWNER_EMAIL }, { collation: CASE_INSENSITIVE });

  if (!existing) {
    await users.insertOne({
      name: OWNER_NAME,
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD_HASH,
      role: 'admin',
      isStripeConnected: false,
      isSuspended: false,
      resetPasswordAttempts: 0,
      balance: 0,
      payoutDetails: '',
      createdAt: now,
      updatedAt: now,
      __v: 0,
    });
    return 'owner admin account created';
  }

  if (existing.role !== 'admin' || existing.isSuspended) {
    await users.updateOne(
      { _id: existing._id },
      { $set: { role: 'admin', isSuspended: false, updatedAt: now } }
    );
    return 'owner admin role restored';
  }

  return 'owner admin account ok';
};
