import { pool, dbMode, memoryStore, saveMemoryStore } from '../config/db.js';
import crypto from 'crypto';

export class Incident {
  static async create({ userId, status = 'active', triggerType = 'manual', latitude = null, longitude = null, riskScore = 0, audioTranscript = '', audioUrl = null, notificationLogs = [], dispatchAfter = null }) {

    const incidentId = crypto.randomUUID();

    const hasValidCoords = latitude !== null && latitude !== undefined && !isNaN(parseFloat(latitude)) &&
      longitude !== null && longitude !== undefined && !isNaN(parseFloat(longitude)) &&
      !(parseFloat(latitude) === 0 && parseFloat(longitude) === 0);

    const latVal = hasValidCoords ? parseFloat(latitude) : null;
    const lngVal = hasValidCoords ? parseFloat(longitude) : null;

    if (dbMode === 'memory') {
      const newIncident = {
        id: incidentId,
        userId,
        status,
        triggerType,
        latitude: latVal,
        longitude: lngVal,
        riskScore: parseInt(riskScore) || 0,
        audioTranscript,
        audioUrl,
        notificationLogs,
        dispatchAfter,
        dispatchClaimedAt: null,
        manualConfirmed: false,
        createdAt: new Date().toISOString()
      };

      memoryStore.incidents.push(newIncident);
      if (hasValidCoords) {
        memoryStore.locationHistory.push({
          id: memoryStore.locationHistory.length + 1,
          incidentId,
          latitude: latVal,
          longitude: lngVal,
          riskScore: parseInt(riskScore) || 0,
          timestamp: new Date().toISOString()
        });
      }

      saveMemoryStore();
      return newIncident;
    }

    // PostgreSQL database flow
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertQuery = `
        INSERT INTO incidents (id, user_id, status, trigger_type, latitude, longitude, risk_score, audio_transcript, audio_url, notification_logs, dispatch_after)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, user_id as "userId", status, trigger_type as "triggerType", latitude, longitude, risk_score as "riskScore", audio_transcript as "audioTranscript", audio_url as "audioUrl", notification_logs as "notificationLogs", dispatch_after as "dispatchAfter", dispatch_claimed_at as "dispatchClaimedAt", manual_confirmed as "manualConfirmed", created_at as "createdAt"
      `;

      const res = await client.query(insertQuery, [
        incidentId,
        userId,
        status,
        triggerType,
        latVal,
        lngVal,
        parseInt(riskScore) || 0,
        audioTranscript,
        audioUrl,
        notificationLogs ? (typeof notificationLogs === 'string' ? notificationLogs : JSON.stringify(notificationLogs)) : null,
        dispatchAfter
      ]);
      const incident = res.rows[0];

      if (hasValidCoords) {
        const insertHistoryQuery = `
          INSERT INTO location_history (incident_id, latitude, longitude, risk_score)
          VALUES ($1, $2, $3, $4)
        `;
        await client.query(insertHistoryQuery, [
          incidentId,
          latVal,
          lngVal,
          parseInt(riskScore) || 0
        ]);
      }

      await client.query('COMMIT');
      return incident;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async findById(id) {
    if (dbMode === 'memory') {
      return memoryStore.incidents.find(i => i.id === id) || null;
    }

    try {
      const query = `
        SELECT id, user_id as "userId", status, trigger_type as "triggerType", 
               latitude, longitude, risk_score as "riskScore", audio_transcript as "audioTranscript", audio_url as "audioUrl",
               notification_logs as "notificationLogs", dispatch_after as "dispatchAfter", dispatch_claimed_at as "dispatchClaimedAt", manual_confirmed as "manualConfirmed",
               created_at as "createdAt" 
        FROM incidents 
        WHERE id = $1
      `;
      const res = await pool.query(query, [id]);
      if (res.rows.length === 0) return null;
      return res.rows[0];
    } catch (err) {
      console.error('[INCIDENT MODEL] findById error:', err.message);
      throw err;
    }
  }

  static async findAll() {
    if (dbMode === 'memory') {
      return [...memoryStore.incidents].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    try {
      const query = `
        SELECT id, user_id as "userId", status, trigger_type as "triggerType", 
               latitude, longitude, risk_score as "riskScore", audio_transcript as "audioTranscript", audio_url as "audioUrl",
               notification_logs as "notificationLogs", dispatch_after as "dispatchAfter", dispatch_claimed_at as "dispatchClaimedAt", manual_confirmed as "manualConfirmed",
               created_at as "createdAt" 
        FROM incidents 
        ORDER BY created_at DESC
      `;
      const res = await pool.query(query);
      return res.rows;
    } catch (err) {
      console.error('[INCIDENT MODEL] findAll error:', err.message);
      throw err;
    }
  }

static async findByUserId(userId) {
    if (dbMode === 'memory') {
      return memoryStore.incidents
        .filter(i => i.userId === userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    try {
      const query = `
        SELECT id, user_id as "userId", status, trigger_type as "triggerType", 
               latitude, longitude, risk_score as "riskScore", audio_transcript as "audioTranscript", audio_url as "audioUrl",
               notification_logs as "notificationLogs", dispatch_after as "dispatchAfter", dispatch_claimed_at as "dispatchClaimedAt", manual_confirmed as "manualConfirmed",
               created_at as "createdAt" 
        FROM incidents 
        WHERE user_id = $1 
        ORDER BY created_at DESC
      `;
      const res = await pool.query(query, [userId]);
      return res.rows;
    } catch (err) {
      console.error('[INCIDENT MODEL] findByUserId error:', err.message);
      throw err;
    }
  }

  static async update(id, updates) {
    if (dbMode === 'memory') {
      const idx = memoryStore.incidents.findIndex(i => i.id === id);
      if (idx === -1) return null;

      const current = memoryStore.incidents[idx];
      if (updates.status) current.status = updates.status;
      if (updates.latitude !== undefined) {
        current.latitude = (updates.latitude !== null && !isNaN(parseFloat(updates.latitude))) ? parseFloat(updates.latitude) : null;
      }
      if (updates.longitude !== undefined) {
        current.longitude = (updates.longitude !== null && !isNaN(parseFloat(updates.longitude))) ? parseFloat(updates.longitude) : null;
      }
      if (updates.riskScore !== undefined) current.riskScore = parseInt(updates.riskScore);
      if (updates.audioTranscript) current.audioTranscript = updates.audioTranscript;
      if (updates.audioUrl !== undefined) current.audioUrl = updates.audioUrl;
      if (updates.notificationLogs !== undefined) current.notificationLogs = updates.notificationLogs;
      if (updates.dispatchClaimedAt !== undefined) current.dispatchClaimedAt = updates.dispatchClaimedAt;

      if (updates.latitude !== undefined || updates.longitude !== undefined) {
        if (current.latitude !== null && current.longitude !== null && !(current.latitude === 0 && current.longitude === 0)) {
          memoryStore.locationHistory.push({
            id: memoryStore.locationHistory.length + 1,
            incidentId: id,
            latitude: current.latitude,
            longitude: current.longitude,
            riskScore: current.riskScore || 0,
            timestamp: new Date().toISOString()
          });
        }
      }

      saveMemoryStore();
      return current;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const fields = [];
      const values = [];
      let valIdx = 1;

      if (updates.status) {
        fields.push(`status = $${valIdx++}`);
        values.push(updates.status);
      }
      if (updates.latitude !== undefined) {
        const latVal = (updates.latitude !== null && !isNaN(parseFloat(updates.latitude))) ? parseFloat(updates.latitude) : null;
        fields.push(`latitude = $${valIdx++}`);
        values.push(latVal);
      }
      if (updates.longitude !== undefined) {
        const lngVal = (updates.longitude !== null && !isNaN(parseFloat(updates.longitude))) ? parseFloat(updates.longitude) : null;
        fields.push(`longitude = $${valIdx++}`);
        values.push(lngVal);
      }
      if (updates.riskScore !== undefined) {
        fields.push(`risk_score = $${valIdx++}`);
        values.push(parseInt(updates.riskScore));
      }
      if (updates.audioTranscript) {
        fields.push(`audio_transcript = $${valIdx++}`);
        values.push(updates.audioTranscript);
      }
      if (updates.audioUrl !== undefined) {
        fields.push(`audio_url = $${valIdx++}`);
        values.push(updates.audioUrl);
      }
      if (updates.notificationLogs !== undefined) {
        fields.push(`notification_logs = $${valIdx++}`);
        values.push(updates.notificationLogs ? (typeof updates.notificationLogs === 'string' ? updates.notificationLogs : JSON.stringify(updates.notificationLogs)) : null);
      }
      if (updates.dispatchClaimedAt !== undefined) {
        fields.push(`dispatch_claimed_at = $${valIdx++}`);
        values.push(updates.dispatchClaimedAt);
      }

      if (fields.length === 0) {
        const query = `SELECT id, user_id as "userId", status, trigger_type as "triggerType", latitude, longitude, risk_score as "riskScore", audio_transcript as "audioTranscript", audio_url as "audioUrl", notification_logs as "notificationLogs", dispatch_after as "dispatchAfter", dispatch_claimed_at as "dispatchClaimedAt", manual_confirmed as "manualConfirmed", created_at as "createdAt" FROM incidents WHERE id = $1`;
        const res = await client.query(query, [id]);
        await client.query('COMMIT');
        return res.rows[0];
      }

      values.push(id);
      const updateQuery = `
        UPDATE incidents 
        SET ${fields.join(', ')} 
        WHERE id = $${valIdx} 
        RETURNING id, user_id as "userId", status, trigger_type as "triggerType", latitude, longitude, risk_score as "riskScore", audio_transcript as "audioTranscript", audio_url as "audioUrl", notification_logs as "notificationLogs", dispatch_after as "dispatchAfter", dispatch_claimed_at as "dispatchClaimedAt", manual_confirmed as "manualConfirmed", created_at as "createdAt"
      `;
      const res = await client.query(updateQuery, values);
      const incident = res.rows[0];

      if (updates.latitude !== undefined || updates.longitude !== undefined) {
        const updatedLat = incident.latitude !== null ? parseFloat(incident.latitude) : null;
        const updatedLng = incident.longitude !== null ? parseFloat(incident.longitude) : null;
        if (updatedLat !== null && updatedLng !== null && !isNaN(updatedLat) && !isNaN(updatedLng) && !(updatedLat === 0 && updatedLng === 0)) {
          const insertHistoryQuery = `
            INSERT INTO location_history (incident_id, latitude, longitude, risk_score)
            VALUES ($1, $2, $3, $4)
          `;
          await client.query(insertHistoryQuery, [
            id,
            updatedLat,
            updatedLng,
            parseInt(incident.riskScore) || 0
          ]);
        }
      }

      await client.query('COMMIT');
      return incident;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async addLocationHistory(incidentId, latitude, longitude, riskScore) {
    if (dbMode === 'memory') {
      const row = {
        id: memoryStore.locationHistory.length + 1,
        incidentId,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        riskScore: parseInt(riskScore),
        timestamp: new Date().toISOString()
      };
      memoryStore.locationHistory.push(row);
      saveMemoryStore();
      return row;
    }

    try {
      const query = `
        INSERT INTO location_history (incident_id, latitude, longitude, risk_score)
        VALUES ($1, $2, $3, $4)
        RETURNING id, incident_id as "incidentId", latitude, longitude, risk_score as "riskScore", timestamp
      `;
      const res = await pool.query(query, [incidentId, parseFloat(latitude), parseFloat(longitude), parseInt(riskScore)]);
      return res.rows[0];
    } catch (err) {
      console.error('[INCIDENT MODEL] addLocationHistory error:', err.message);
      throw err;
    }
  }

  static async getLocationHistory(incidentId) {
    if (dbMode === 'memory') {
      return memoryStore.locationHistory.filter(h => h.incidentId === incidentId);
    }

    try {
      const query = `
        SELECT id, incident_id as "incidentId", latitude, longitude, risk_score as "riskScore", timestamp 
        FROM location_history 
        WHERE incident_id = $1 
        ORDER BY timestamp ASC
      `;
      const res = await pool.query(query, [incidentId]);
      return res.rows;
    } catch (err) {
      console.error('[INCIDENT MODEL] getLocationHistory error:', err.message);
      throw err;
    }
  }

  // Claim due alerts with row-level locking so multiple API replicas cannot
  // dispatch the same pending incident at the same time. A stale claim is
  // reclaimable after a process crash; delivery is therefore at least once.
  static async claimDueMonitoringIncidents(limit = 10) {
    const now = Date.now();
    if (dbMode === 'memory') {
      const claimed = memoryStore.incidents.filter((incident) => {
        const due = incident.status === 'pending_dispatch' && incident.dispatchAfter && new Date(incident.dispatchAfter).getTime() <= now;
        const stale = incident.status === 'dispatching' && incident.dispatchClaimedAt && new Date(incident.dispatchClaimedAt).getTime() <= now - 300000;
        return incident.triggerType === 'monitoring' && (due || stale);
      }).slice(0, limit);
      for (const incident of claimed) {
        incident.status = 'dispatching';
        incident.dispatchClaimedAt = new Date(now).toISOString();
      }
      if (claimed.length) saveMemoryStore();
      return claimed;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(`
        WITH due AS (
          SELECT id
          FROM incidents
          WHERE trigger_type = 'monitoring'
            AND (
              (status = 'pending_dispatch' AND dispatch_after <= NOW())
              OR (status = 'dispatching' AND dispatch_claimed_at <= NOW() - INTERVAL '5 minutes')
            )
          ORDER BY dispatch_after NULLS LAST
          LIMIT $1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE incidents AS incident
        SET status = 'dispatching', dispatch_claimed_at = NOW()
        FROM due
        WHERE incident.id = due.id
        RETURNING incident.id, incident.user_id as "userId", incident.status,
          incident.trigger_type as "triggerType", incident.latitude, incident.longitude,
          incident.risk_score as "riskScore", incident.audio_transcript as "audioTranscript",
          incident.audio_url as "audioUrl", incident.notification_logs as "notificationLogs",
          incident.dispatch_after as "dispatchAfter", incident.dispatch_claimed_at as "dispatchClaimedAt", incident.manual_confirmed as "manualConfirmed",
          incident.created_at as "createdAt"
      `, [limit]);
      await client.query('COMMIT');
      return result.rows;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async completeMonitoringDispatch(id) {
    if (dbMode === 'memory') {
      const incident = memoryStore.incidents.find((item) => item.id === id && item.status === 'dispatching');
      if (!incident) return null;
      incident.status = 'active';
      incident.dispatchClaimedAt = null;
      saveMemoryStore();
      return incident;
    }
    const result = await pool.query(`
      UPDATE incidents SET status = 'active', dispatch_claimed_at = NULL
      WHERE id = $1 AND status = 'dispatching'
      RETURNING id, user_id as "userId", status, trigger_type as "triggerType", latitude,
        longitude, risk_score as "riskScore", audio_transcript as "audioTranscript",
        audio_url as "audioUrl", notification_logs as "notificationLogs",
        dispatch_after as "dispatchAfter", manual_confirmed as "manualConfirmed", created_at as "createdAt"
    `, [id]);
    return result.rows[0] || null;
  }

  static async releaseMonitoringDispatch(id) {
    if (dbMode === 'memory') {
      const incident = memoryStore.incidents.find((item) => item.id === id && item.status === 'dispatching');
      if (!incident) return null;
      incident.status = 'pending_dispatch';
      incident.dispatchClaimedAt = null;
      saveMemoryStore();
      return incident;
    }
    const result = await pool.query(`
      UPDATE incidents SET status = 'pending_dispatch', dispatch_claimed_at = NULL
      WHERE id = $1 AND status = 'dispatching'
      RETURNING id
    `, [id]);
    return result.rows[0] || null;
  }

  // The status and deadline predicates make cancel-vs-dispatch an atomic race:
  // a cancellation succeeds only while the incident remains inside its grace window.
  static async cancelPendingMonitoringIncident(id, userId) {
    if (dbMode === 'memory') {
      const incident = memoryStore.incidents.find((item) =>
        item.id === id && item.userId === userId && item.triggerType === 'monitoring' &&
        item.status === 'pending_dispatch' && new Date(item.dispatchAfter).getTime() > Date.now()
      );
      if (!incident) return null;
      incident.status = 'cancelled';
      saveMemoryStore();
      return incident;
    }
    const result = await pool.query(`
      UPDATE incidents SET status = 'cancelled'
      WHERE id = $1 AND user_id = $2 AND trigger_type = 'monitoring'
        AND status = 'pending_dispatch' AND dispatch_after > NOW()
      RETURNING id, user_id as "userId", status, trigger_type as "triggerType",
        latitude, longitude, risk_score as "riskScore", audio_transcript as "audioTranscript",
        audio_url as "audioUrl", dispatch_after as "dispatchAfter", created_at as "createdAt"
    `, [id, userId]);
    return result.rows[0] || null;
  }

  // User confirmation ends the grace period immediately and claims the row,
  // so the regular poller and this request cannot both send the alert.
  static async confirmPendingMonitoringIncident(id, userId, manualRiskScore = 90) {
    if (dbMode === 'memory') {
      const incident = memoryStore.incidents.find((item) =>
        item.id === id && item.userId === userId && item.triggerType === 'monitoring' && item.status === 'pending_dispatch'
      );
      if (!incident) return null;
      incident.status = 'dispatching';
      incident.dispatchClaimedAt = new Date().toISOString();
      incident.manualConfirmed = true;
      incident.riskScore = manualRiskScore;
      saveMemoryStore();
      return incident;
    }
    const result = await pool.query(`
      UPDATE incidents SET status = 'dispatching', dispatch_claimed_at = NOW(), manual_confirmed = TRUE, risk_score = $3
      WHERE id = $1 AND user_id = $2 AND trigger_type = 'monitoring' AND status = 'pending_dispatch'
      RETURNING id, user_id as "userId", status, trigger_type as "triggerType",
        latitude, longitude, risk_score as "riskScore", audio_transcript as "audioTranscript",
        audio_url as "audioUrl", notification_logs as "notificationLogs",
        dispatch_after as "dispatchAfter", dispatch_claimed_at as "dispatchClaimedAt", manual_confirmed as "manualConfirmed",
        created_at as "createdAt"
    `, [id, userId, manualRiskScore]);
    return result.rows[0] || null;
  }

  static async delete(id) {
    if (dbMode === 'memory') {
      const idx = memoryStore.incidents.findIndex(i => i.id === id);
      if (idx === -1) return false;
      memoryStore.incidents.splice(idx, 1);

      // Clear location history for this incident
      for (let i = memoryStore.locationHistory.length - 1; i >= 0; i--) {
        if (memoryStore.locationHistory[i].incidentId === id) {
          memoryStore.locationHistory.splice(i, 1);
        }
      }
      saveMemoryStore();
      return true;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM location_history WHERE incident_id = $1', [id]);

      try {
        await client.query('DELETE FROM reports WHERE incident_id = $1', [id]);
      } catch (err) {
        // Table reports might not exist or already be cascade deleted
      }

      const res = await client.query('DELETE FROM incidents WHERE id = $1', [id]);
      await client.query('COMMIT');
      return res.rowCount > 0;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
export default Incident;
