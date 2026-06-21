import { pool, dbMode } from '../config/db.js';

// Memory cache fallback storage
const memoryIncidents = [];
const memoryLocationHistory = [];

export class Incident {
  static async create({ userId, status = 'active', triggerType = 'manual', latitude, longitude, riskScore = 0, audioTranscript = '' }) {
    const incidentId = `inc_${Math.random().toString(36).substr(2, 9)}`;

    if (dbMode === 'memory') {
      const newIncident = {
        id: incidentId,
        userId,
        status,
        triggerType,
        latitude: parseFloat(latitude) || 0.0,
        longitude: parseFloat(longitude) || 0.0,
        riskScore: parseInt(riskScore) || 0,
        audioTranscript,
        createdAt: new Date().toISOString()
      };
      
      memoryIncidents.push(newIncident);
      memoryLocationHistory.push({
        id: memoryLocationHistory.length + 1,
        incidentId,
        latitude: parseFloat(latitude) || 0.0,
        longitude: parseFloat(longitude) || 0.0,
        riskScore: parseInt(riskScore) || 0,
        timestamp: new Date().toISOString()
      });

      return newIncident;
    }

    // PostgreSQL database flow
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertQuery = `
        INSERT INTO incidents (id, user_id, status, trigger_type, latitude, longitude, risk_score, audio_transcript)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, user_id as "userId", status, trigger_type as "triggerType", latitude, longitude, risk_score as "riskScore", audio_transcript as "audioTranscript", created_at as "createdAt"
      `;
      
      const res = await client.query(insertQuery, [
        incidentId, 
        userId, 
        status, 
        triggerType, 
        parseFloat(latitude) || 0.0, 
        parseFloat(longitude) || 0.0, 
        parseInt(riskScore) || 0, 
        audioTranscript
      ]);
      const incident = res.rows[0];

      const insertHistoryQuery = `
        INSERT INTO location_history (incident_id, latitude, longitude, risk_score)
        VALUES ($1, $2, $3, $4)
      `;
      await client.query(insertHistoryQuery, [
        incidentId,
        parseFloat(latitude) || 0.0,
        parseFloat(longitude) || 0.0,
        parseInt(riskScore) || 0
      ]);

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
      return memoryIncidents.find(i => i.id === id) || null;
    }

    try {
      const query = `
        SELECT id, user_id as "userId", status, trigger_type as "triggerType", 
               latitude, longitude, risk_score as "riskScore", audio_transcript as "audioTranscript", 
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
      return [...memoryIncidents].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    try {
      const query = `
        SELECT id, user_id as "userId", status, trigger_type as "triggerType", 
               latitude, longitude, risk_score as "riskScore", audio_transcript as "audioTranscript", 
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
      return memoryIncidents
        .filter(i => i.userId === userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    try {
      const query = `
        SELECT id, user_id as "userId", status, trigger_type as "triggerType", 
               latitude, longitude, risk_score as "riskScore", audio_transcript as "audioTranscript", 
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
      const idx = memoryIncidents.findIndex(i => i.id === id);
      if (idx === -1) return null;

      const current = memoryIncidents[idx];
      if (updates.status) current.status = updates.status;
      if (updates.latitude !== undefined) current.latitude = parseFloat(updates.latitude);
      if (updates.longitude !== undefined) current.longitude = parseFloat(updates.longitude);
      if (updates.riskScore !== undefined) current.riskScore = parseInt(updates.riskScore);
      if (updates.audioTranscript) current.audioTranscript = updates.audioTranscript;

      if (updates.latitude !== undefined || updates.longitude !== undefined) {
        memoryLocationHistory.push({
          id: memoryLocationHistory.length + 1,
          incidentId: id,
          latitude: current.latitude,
          longitude: current.longitude,
          riskScore: current.riskScore,
          timestamp: new Date().toISOString()
        });
      }

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
        fields.push(`latitude = $${valIdx++}`);
        values.push(parseFloat(updates.latitude));
      }
      if (updates.longitude !== undefined) {
        fields.push(`longitude = $${valIdx++}`);
        values.push(parseFloat(updates.longitude));
      }
      if (updates.riskScore !== undefined) {
        fields.push(`risk_score = $${valIdx++}`);
        values.push(parseInt(updates.riskScore));
      }
      if (updates.audioTranscript) {
        fields.push(`audio_transcript = $${valIdx++}`);
        values.push(updates.audioTranscript);
      }

      if (fields.length === 0) {
        const query = `SELECT id, user_id as "userId", status, trigger_type as "triggerType", latitude, longitude, risk_score as "riskScore", audio_transcript as "audioTranscript", created_at as "createdAt" FROM incidents WHERE id = $1`;
        const res = await client.query(query, [id]);
        await client.query('COMMIT');
        return res.rows[0];
      }

      values.push(id);
      const updateQuery = `
        UPDATE incidents 
        SET ${fields.join(', ')} 
        WHERE id = $${valIdx} 
        RETURNING id, user_id as "userId", status, trigger_type as "triggerType", latitude, longitude, risk_score as "riskScore", audio_transcript as "audioTranscript", created_at as "createdAt"
      `;
      const res = await client.query(updateQuery, values);
      const incident = res.rows[0];

      if (updates.latitude !== undefined || updates.longitude !== undefined) {
        const insertHistoryQuery = `
          INSERT INTO location_history (incident_id, latitude, longitude, risk_score)
          VALUES ($1, $2, $3, $4)
        `;
        await client.query(insertHistoryQuery, [
          id,
          parseFloat(incident.latitude),
          parseFloat(incident.longitude),
          parseInt(incident.riskScore)
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

  static async addLocationHistory(incidentId, latitude, longitude, riskScore) {
    if (dbMode === 'memory') {
      const row = {
        id: memoryLocationHistory.length + 1,
        incidentId,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        riskScore: parseInt(riskScore),
        timestamp: new Date().toISOString()
      };
      memoryLocationHistory.push(row);
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
      return memoryLocationHistory.filter(h => h.incidentId === incidentId);
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

  static async delete(id) {
    if (dbMode === 'memory') {
      const idx = memoryIncidents.findIndex(i => i.id === id);
      if (idx === -1) return false;
      memoryIncidents.splice(idx, 1);
      
      // Clear location history for this incident
      for (let i = memoryLocationHistory.length - 1; i >= 0; i--) {
        if (memoryLocationHistory[i].incidentId === id) {
          memoryLocationHistory.splice(i, 1);
        }
      }
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
