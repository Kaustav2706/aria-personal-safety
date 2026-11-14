/**
 * Seed Police Dispatcher Account
 *
 * Creates an initial police dispatcher account with role='police'.
 * Run once to bootstrap the first dispatcher, then share credentials securely.
 *
 * Usage:
 *   cd backend
 *   DISPATCHER_EMAIL=dispatch@police.gov \
 *   DISPATCHER_PASSWORD=<strong-password> \
 *   DISPATCHER_NAME="Dispatch Command" \
 *   node src/scripts/seedPoliceAccount.js
 *
 * REQUIRED environment variables:
 *   DISPATCHER_PASSWORD  — the account password (no default; script refuses to run without it)
 *
 * Optional environment variables:
 *   DISPATCHER_EMAIL     — account email          (default: dispatch@police.local)
 *   DISPATCHER_NAME      — display name           (default: Dispatch Command)
 */

import bcrypt from 'bcryptjs';
import { initializeDatabase, memoryStore, dbMode, pool } from '../config/db.js';
import { User } from '../models/User.model.js';
import dotenv from 'dotenv';

dotenv.config();

// ── N23: Require an explicit password — no default, no fallback ──────────────
const rawPassword = process.env.DISPATCHER_PASSWORD;

if (!rawPassword || !rawPassword.trim()) {
  console.error(
    '❌ DISPATCHER_PASSWORD environment variable is required and must not be empty.\n' +
    '   Set it before running this script:\n\n' +
    '     DISPATCHER_EMAIL=dispatch@police.gov \\\n' +
    '     DISPATCHER_PASSWORD=<your-strong-password> \\\n' +
    '     node src/scripts/seedPoliceAccount.js\n'
  );
  process.exit(1);
}

const EMAIL    = process.env.DISPATCHER_EMAIL || 'dispatch@police.local';
const NAME     = process.env.DISPATCHER_NAME  || 'Dispatch Command';
// Keep the trimmed password in a local constant; never log or expose it.
const PASSWORD = rawPassword.trim();

async function seed() {
  await initializeDatabase();

  const existing = await User.findByEmail(EMAIL);
  if (existing) {
    if (existing.role === 'police') {
      console.log(`✅ Police dispatcher account already exists: ${EMAIL}`);
    } else {
      console.warn(`⚠️  Account ${EMAIL} exists but has role='${existing.role}'. Update role manually.`);
    }
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const dispatcher = await User.create({
    name: NAME,
    email: EMAIL,
    phone: '000-000-0000',
    passwordHash,
    role: 'police',
  });

  console.log('\n✅ Police dispatcher account created successfully!');
  console.log('   Email   :', dispatcher.email);
  console.log('   Role    :', dispatcher.role);
  console.log('   ID      :', dispatcher.id);
  console.log('\n   The supplied password has been hashed and stored. Keep it safe.\n');

  if (dbMode === 'postgres') {
    await pool.end();
  }
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Failed to seed police account:', err.message);
  process.exit(1);
});
