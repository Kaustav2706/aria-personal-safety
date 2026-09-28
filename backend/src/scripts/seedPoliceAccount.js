/**
 * Seed Police Dispatcher Account
 *
 * Creates an initial police dispatcher account with role='police'.
 * Run once to bootstrap the first dispatcher, then share credentials securely.
 *
 * Usage:
 *   cd backend
 *   node src/scripts/seedPoliceAccount.js
 *
 * Override defaults with environment variables:
 *   DISPATCHER_EMAIL=dispatch@police.gov \
 *   DISPATCHER_PASSWORD=Str0ngP@ssw0rd! \
 *   DISPATCHER_NAME="Dispatch Command" \
 *   node src/scripts/seedPoliceAccount.js
 */

import bcrypt from 'bcryptjs';
import { initializeDatabase, memoryStore, dbMode, pool } from '../config/db.js';
import { User } from '../models/User.model.js';
import dotenv from 'dotenv';

dotenv.config();

const EMAIL    = process.env.DISPATCHER_EMAIL    || 'dispatch@police.local';
const PASSWORD = process.env.DISPATCHER_PASSWORD || 'ChangeMe123!';
const NAME     = process.env.DISPATCHER_NAME     || 'Dispatch Command';

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
  console.log('\n⚠️  Change the default password immediately after first login.\n');

  if (dbMode === 'postgres') {
    await pool.end();
  }
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Failed to seed police account:', err.message);
  process.exit(1);
});
