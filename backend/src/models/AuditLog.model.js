import crypto from 'crypto';
import { pool, dbMode, memoryStore, saveMemoryStore } from '../config/db.js';
import { User } from './User.model.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AUDIT LOG MODEL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Records an immutable audit trail for every dispatcher action:
 * - viewed: which officer opened which incident file
 * - resolved: which officer closed/resolved an incident
 * - report_generated: which officer generated an official PDF dossier
 * - deleted: which officer deleted an incident record
 *
 * Stores who, what, when, and IP address with full PostgreSQL and
 * memoryStore fallback support.
 */
export class AuditLog {
  static async record({ userId, action, incidentId = null, details = {}, ipAddress = null }) {
    const id = `audit_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();

    let userName = 'Unknown Dispatcher';
    let userEmail = 'unknown@dispatch.local';
    try {
      if (userId) {
        const officer = await User.findById(userId);
        if (officer) {
          userName = officer.name || userName;
          userEmail = officer.email || userEmail;
        }
      }
    } catch (err) {
      // Ignore user lookup error
    }

    console.log(`🛡️ [AUDIT] Dispatcher ${userName} (${userEmail}) performed '${action}' on incident ${incidentId || 'N/A'}`);

    const memoryFallback = () => {
      if (!memoryStore.auditLogs) memoryStore.auditLogs = [];
      const entry = {
        id,
        userId,
        userName,
        userEmail,
        action,
        incidentId,
        details: typeof details === 'object' ? details : {},
        ipAddress,
        createdAt
      };
      memoryStore.auditLogs.push(entry);
      saveMemoryStore();
      return entry;
    };

    if (dbMode === 'memory') {
      return memoryFallback();
    }

    try {
      const result = await pool.query(`
        INSERT INTO audit_logs (id, user_id, user_name, user_email, action, incident_id, details, ip_address, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, user_id AS "userId", user_name AS "userName", user_email AS "userEmail",
          action, incident_id AS "incidentId", details, ip_address AS "ipAddress",
          created_at AS "createdAt"
      `, [id, userId, userName, userEmail, action, incidentId, JSON.stringify(details), ipAddress, createdAt]);
      return result.rows[0];
    } catch (err) {
      console.warn('[AUDIT DB ERROR, using fallback]:', err.message);
      return memoryFallback();
    }
  }

  static async findByIncidentId(incidentId) {
    const memoryFallback = () => {
      if (!memoryStore.auditLogs) return [];
      return memoryStore.auditLogs
        .filter(log => log.incidentId === incidentId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    };

    if (dbMode === 'memory') {
      return memoryFallback();
    }

    try {
      const result = await pool.query(`
        SELECT id, user_id AS "userId", user_name AS "userName", user_email AS "userEmail",
          action, incident_id AS "incidentId", details, ip_address AS "ipAddress",
          created_at AS "createdAt"
        FROM audit_logs
        WHERE incident_id = $1
        ORDER BY created_at DESC
      `, [incidentId]);
      return result.rows;
    } catch (err) {
      console.warn('[AUDIT DB ERROR, using fallback]:', err.message);
      return memoryFallback();
    }
  }

  static async findAll({ limit = 100, offset = 0 } = {}) {
    const memoryFallback = () => {
      if (!memoryStore.auditLogs) return [];
      return [...memoryStore.auditLogs]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(offset, offset + limit);
    };

    if (dbMode === 'memory') {
      return memoryFallback();
    }

    try {
      const result = await pool.query(`
        SELECT id, user_id AS "userId", user_name AS "userName", user_email AS "userEmail",
          action, incident_id AS "incidentId", details, ip_address AS "ipAddress",
          created_at AS "createdAt"
        FROM audit_logs
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);
      return result.rows;
    } catch (err) {
      console.warn('[AUDIT DB ERROR, using fallback]:', err.message);
      return memoryFallback();
    }
  }
}

export default AuditLog;
