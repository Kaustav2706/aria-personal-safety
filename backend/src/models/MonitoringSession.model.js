import { pool, dbMode, memoryStore, saveMemoryStore } from '../config/db.js';

export class MonitoringSession {
  /**
   * Creates a new monitoring session for a user.
   * @param {string} userId - The user ID starting the session
   * @returns {Promise<Object>} The created session object
   */
  static async create(userId) {
    const sessionId = `mon_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    if (dbMode === 'memory') {
      const newSession = {
        id: sessionId,
        userId,
        startedAt: now,
        lastActivity: now,
        status: 'active'
      };
      memoryStore.sessions.push(newSession);
      saveMemoryStore();
      return newSession;
    }

    // PostgreSQL database flow
    try {
      const query = `
        INSERT INTO monitoring_sessions (id, user_id, started_at, last_activity, status)
        VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'active')
        RETURNING id, user_id AS "userId", started_at AS "startedAt", last_activity AS "lastActivity", status
      `;
      const res = await pool.query(query, [sessionId, userId]);
      return res.rows[0];
    } catch (err) {
      console.error('[MONITORING SESSION MODEL] create error:', err.message);
      throw err;
    }
  }

  /**
   * Finds a monitoring session by its ID.
   * @param {string} id - The session ID
   * @returns {Promise<Object|null>} The session or null
   */
  static async findById(id) {
    if (dbMode === 'memory') {
      return memoryStore.sessions.find(s => s.id === id) || null;
    }

    try {
      const query = `
        SELECT id, user_id AS "userId", started_at AS "startedAt", last_activity AS "lastActivity", status
        FROM monitoring_sessions
        WHERE id = $1
      `;
      const res = await pool.query(query, [id]);
      if (res.rows.length === 0) return null;
      return res.rows[0];
    } catch (err) {
      console.error('[MONITORING SESSION MODEL] findById error:', err.message);
      throw err;
    }
  }

  /**
   * Finds the most recent active session for a given user.
   * @param {string} userId - The user ID
   * @returns {Promise<Object|null>} The active session or null
   */
  static async findActiveByUserId(userId) {
    if (dbMode === 'memory') {
      return memoryStore.sessions.find(s => s.userId === userId && s.status === 'active') || null;
    }

    try {
      const query = `
        SELECT id, user_id AS "userId", started_at AS "startedAt", last_activity AS "lastActivity", status
        FROM monitoring_sessions
        WHERE user_id = $1 AND status = 'active'
        ORDER BY started_at DESC
        LIMIT 1
      `;
      const res = await pool.query(query, [userId]);
      if (res.rows.length === 0) return null;
      return res.rows[0];
    } catch (err) {
      console.error('[MONITORING SESSION MODEL] findActiveByUserId error:', err.message);
      throw err;
    }
  }

  /**
   * Touches the last_activity timestamp of a session.
   * @param {string} id - The session ID
   * @returns {Promise<Object|null>} The updated session
   */
  static async updateActivity(id) {
    if (dbMode === 'memory') {
      const session = memoryStore.sessions.find(s => s.id === id);
      if (!session) return null;
      session.lastActivity = new Date().toISOString();
      saveMemoryStore();
      return session;
    }

    try {
      const query = `
        UPDATE monitoring_sessions
        SET last_activity = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, user_id AS "userId", started_at AS "startedAt", last_activity AS "lastActivity", status
      `;
      const res = await pool.query(query, [id]);
      if (res.rows.length === 0) return null;
      return res.rows[0];
    } catch (err) {
      console.error('[MONITORING SESSION MODEL] updateActivity error:', err.message);
      throw err;
    }
  }

  /**
   * Deactivates a monitoring session by setting status to 'inactive'.
   * @param {string} id - The session ID
   * @returns {Promise<Object|null>} The deactivated session
   */
  static async deactivate(id) {
    if (dbMode === 'memory') {
      const session = memoryStore.sessions.find(s => s.id === id);
      if (!session) return null;
      session.status = 'inactive';
      session.lastActivity = new Date().toISOString();
      saveMemoryStore();
      return session;
    }

    try {
      const query = `
        UPDATE monitoring_sessions
        SET status = 'inactive', last_activity = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, user_id AS "userId", started_at AS "startedAt", last_activity AS "lastActivity", status
      `;
      const res = await pool.query(query, [id]);
      if (res.rows.length === 0) return null;
      return res.rows[0];
    } catch (err) {
      console.error('[MONITORING SESSION MODEL] deactivate error:', err.message);
      throw err;
    }
  }
}

export default MonitoringSession;
