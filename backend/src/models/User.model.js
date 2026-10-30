import { pool, dbMode, memoryStore, saveMemoryStore } from '../config/db.js';
import crypto from 'crypto';
import { normalizePhoneNumber } from '../utils/phoneUtils.js';

export class User {
  static async create({ name, email, phone, passwordHash, role = 'user', emergencyContacts = [], language = null }) {

    const userId = crypto.randomUUID();

    if (dbMode === 'memory') {
      const newUser = {
        id: userId,
        name,
        email,
        phone,
        passwordHash,
        role,
        language: language || null,
        emergencyContacts: emergencyContacts.map(c => ({ name: c.name, phone: c.phone })),
        createdAt: new Date().toISOString()
      };
      memoryStore.users.push(newUser);

      emergencyContacts.forEach(contact => {
        memoryStore.contacts.push({ user_id: userId, name: contact.name, phone: contact.phone });
      });

      saveMemoryStore();
      return newUser;
    }

    // PostgreSQL database flow
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertUserQuery = `
        INSERT INTO users (id, name, email, phone, password_hash, role, language)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, name, email, phone, role, language, created_at as "createdAt"
      `;
      const userRes = await client.query(insertUserQuery, [userId, name, email, phone, passwordHash, role, language || null]);
      const user = userRes.rows[0];

      const savedContacts = [];
      if (emergencyContacts && emergencyContacts.length > 0) {
        for (const contact of emergencyContacts) {
          const normPhone = normalizePhoneNumber(contact.phone);
          const contactQuery = `
            INSERT INTO emergency_contacts (user_id, name, phone)
            VALUES ($1, $2, $3)
            RETURNING name, phone
          `;
          const contactRes = await client.query(contactQuery, [userId, contact.name, normPhone]);
          savedContacts.push(contactRes.rows[0]);
        }
      }

      await client.query('COMMIT');
      return {
        ...user,
        emergencyContacts: savedContacts
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async findByEmail(email) {
    if (dbMode === 'memory') {
      const user = memoryStore.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user) return null;

      const contacts = memoryStore.contacts.filter(c => c.user_id === user.id);
      return {
        ...user,
        emergencyContacts: contacts.map(c => ({ name: c.name, phone: c.phone }))
      };
    }

    try {
      const userRes = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
      if (userRes.rows.length === 0) return null;

      const user = userRes.rows[0];
      const contactsRes = await pool.query('SELECT name, phone FROM emergency_contacts WHERE user_id = $1', [user.id]);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        passwordHash: user.password_hash,
        role: user.role || 'user',
        language: user.language || null,
        emergencyContacts: contactsRes.rows,
        createdAt: user.created_at
      };
    } catch (err) {
      console.error('[USER MODEL] findByEmail error:', err.message);
      throw err;
    }
  }

  static async findById(id) {
    if (dbMode === 'memory') {
      const user = memoryStore.users.find(u => u.id === id);
      if (!user) return null;

      const contacts = memoryStore.contacts.filter(c => c.user_id === user.id);
      return {
        ...user,
        emergencyContacts: contacts.map(c => ({ name: c.name, phone: c.phone }))
      };
    }

    try {
      const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      if (userRes.rows.length === 0) return null;

      const user = userRes.rows[0];
      const contactsRes = await pool.query('SELECT name, phone FROM emergency_contacts WHERE user_id = $1', [user.id]);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        passwordHash: user.password_hash,
        role: user.role || 'user',
        language: user.language || null,
        emergencyContacts: contactsRes.rows,
        createdAt: user.created_at
      };
    } catch (err) {
      console.error('[USER MODEL] findById error:', err.message);
      throw err;
    }
  }

  static async update(id, updates) {
    if (dbMode === 'memory') {
      const idx = memoryStore.users.findIndex(u => u.id === id);
      if (idx === -1) return null;

      if (updates.name) memoryStore.users[idx].name = updates.name;
      if (updates.phone) memoryStore.users[idx].phone = updates.phone;
      if (updates.language !== undefined) memoryStore.users[idx].language = updates.language || null;

      if (updates.emergencyContacts) {
        // Delete contacts
        for (let i = memoryStore.contacts.length - 1; i >= 0; i--) {
          if (memoryStore.contacts[i].user_id === id) {
            memoryStore.contacts.splice(i, 1);
          }
        }
        // Insert contacts
        updates.emergencyContacts.forEach(contact => {
          memoryStore.contacts.push({ user_id: id, name: contact.name, phone: contact.phone });
        });
        memoryStore.users[idx].emergencyContacts = updates.emergencyContacts.map(c => ({ name: c.name, phone: c.phone }));
      }

      saveMemoryStore();
      return memoryStore.users[idx];
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const fields = [];
      const values = [];
      let valIdx = 1;

      if (updates.name) {
        fields.push(`name = $${valIdx++}`);
        values.push(updates.name);
      }
      if (updates.phone) {
        fields.push(`phone = $${valIdx++}`);
        values.push(updates.phone);
      }
      if (updates.language !== undefined) {
        fields.push(`language = $${valIdx++}`);
        values.push(updates.language || null);
      }

      let user = null;
      if (fields.length > 0) {
        values.push(id);
        const updateQuery = `
          UPDATE users 
          SET ${fields.join(', ')} 
          WHERE id = $${valIdx} 
          RETURNING id, name, email, phone, role, language, created_at as "createdAt"
        `;
        const userRes = await client.query(updateQuery, values);
        user = userRes.rows[0];
      } else {
        const userRes = await client.query('SELECT id, name, email, phone, role, language, created_at as "createdAt" FROM users WHERE id = $1', [id]);
        user = userRes.rows[0];
      }

      if (!user) {
        await client.query('ROLLBACK');
        return null;
      }

      if (updates.emergencyContacts) {
        await client.query('DELETE FROM emergency_contacts WHERE user_id = $1', [id]);

        const contacts = [];
        for (const contact of updates.emergencyContacts) {
          const normPhone = normalizePhoneNumber(contact.phone);
          const insertContactQuery = `
            INSERT INTO emergency_contacts (user_id, name, phone) 
            VALUES ($1, $2, $3) 
            RETURNING name, phone
          `;
          const res = await client.query(insertContactQuery, [id, contact.name, normPhone]);
          contacts.push(res.rows[0]);
        }
        user.emergencyContacts = contacts;
      } else {
        const res = await client.query('SELECT name, phone FROM emergency_contacts WHERE user_id = $1', [id]);
        user.emergencyContacts = res.rows;
      }

      await client.query('COMMIT');
      return user;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
export default User;
