import crypto from 'crypto';
import { pool, dbMode, memoryStore, saveMemoryStore } from '../config/db.js';

export function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class AuthSession {
  static async create({ userId, refreshTokenHash, expiresAt }) {
    const id = `auth_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();

    if (dbMode === 'memory') {
      const session = {
        id,
        userId,
        refreshTokenHash,
        createdAt,
        expiresAt,
        lastUsedAt: null,
        revokedAt: null
      };
      memoryStore.authSessions.push(session);
      saveMemoryStore();
      return session;
    }

    const result = await pool.query(`
      INSERT INTO auth_sessions (id, user_id, refresh_token_hash, created_at, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id AS "userId", refresh_token_hash AS "refreshTokenHash",
        created_at AS "createdAt", expires_at AS "expiresAt",
        last_used_at AS "lastUsedAt", revoked_at AS "revokedAt"
    `, [id, userId, refreshTokenHash, createdAt, expiresAt]);
    return result.rows[0];
  }

  static async findActiveById(id) {
    if (dbMode === 'memory') {
      const session = memoryStore.authSessions.find(item => item.id === id);
      if (!session || session.revokedAt || new Date(session.expiresAt) <= new Date()) return null;
      return session;
    }

    const result = await pool.query(`
      SELECT id, user_id AS "userId", refresh_token_hash AS "refreshTokenHash",
        created_at AS "createdAt", expires_at AS "expiresAt",
        last_used_at AS "lastUsedAt", revoked_at AS "revokedAt"
      FROM auth_sessions
      WHERE id = $1 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP
    `, [id]);
    return result.rows[0] || null;
  }

  static async findActiveByRefreshTokenHash(refreshTokenHash) {
    if (dbMode === 'memory') {
      return memoryStore.authSessions.find(item =>
        item.refreshTokenHash === refreshTokenHash &&
        !item.revokedAt &&
        new Date(item.expiresAt) > new Date()
      ) || null;
    }

    const result = await pool.query(`
      SELECT id, user_id AS "userId", refresh_token_hash AS "refreshTokenHash",
        created_at AS "createdAt", expires_at AS "expiresAt",
        last_used_at AS "lastUsedAt", revoked_at AS "revokedAt"
      FROM auth_sessions
      WHERE refresh_token_hash = $1 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP
    `, [refreshTokenHash]);
    return result.rows[0] || null;
  }

  static async rotate(id, refreshTokenHash, expiresAt) {
    if (dbMode === 'memory') {
      const session = memoryStore.authSessions.find(item => item.id === id);
      if (!session || session.revokedAt) return null;
      session.refreshTokenHash = refreshTokenHash;
      session.expiresAt = expiresAt;
      session.lastUsedAt = new Date().toISOString();
      saveMemoryStore();
      return session;
    }

    const result = await pool.query(`
      UPDATE auth_sessions
      SET refresh_token_hash = $2, expires_at = $3, last_used_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP
      RETURNING id, user_id AS "userId", refresh_token_hash AS "refreshTokenHash",
        created_at AS "createdAt", expires_at AS "expiresAt",
        last_used_at AS "lastUsedAt", revoked_at AS "revokedAt"
    `, [id, refreshTokenHash, expiresAt]);
    return result.rows[0] || null;
  }

  static async revoke(id) {
    if (dbMode === 'memory') {
      const session = memoryStore.authSessions.find(item => item.id === id);
      if (!session) return false;
      session.revokedAt = new Date().toISOString();
      saveMemoryStore();
      return true;
    }

    const result = await pool.query(`
      UPDATE auth_sessions
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND revoked_at IS NULL
    `, [id]);
    return result.rowCount > 0;
  }

  static async revokeAllForUser(userId) {
    if (dbMode === 'memory') {
      const revokedAt = new Date().toISOString();
      let count = 0;
      for (const session of memoryStore.authSessions) {
        if (session.userId === userId && !session.revokedAt) {
          session.revokedAt = revokedAt;
          count++;
        }
      }
      saveMemoryStore();
      return count;
    }

    const result = await pool.query(`
      UPDATE auth_sessions
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND revoked_at IS NULL
    `, [userId]);
    return result.rowCount;
  }
}

export default AuthSession;
