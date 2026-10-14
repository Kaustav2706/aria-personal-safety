import { pool } from '../config/db.js';

async function main() {
  const contacts = await pool.query('SELECT id, user_id, name, phone FROM emergency_contacts');
  console.log('Existing contacts:', contacts.rows);

  for (const c of contacts.rows) {
    let p = c.phone.trim().replace(/[\s\-\(\)]/g, '');
    if (p.length === 10 && /^[6-9]\d{9}$/.test(p)) {
      const normalized = `+91${p}`;
      await pool.query('UPDATE emergency_contacts SET phone = $1 WHERE id = $2', [normalized, c.id]);
      console.log(`Updated contact ${c.name} (${c.id}): ${c.phone} -> ${normalized}`);
    }
  }

  const updated = await pool.query('SELECT id, user_id, name, phone FROM emergency_contacts');
  console.log('Contacts after update:', updated.rows);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
