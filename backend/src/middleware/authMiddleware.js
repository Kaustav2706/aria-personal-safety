import jwt from 'jsonwebtoken';
import { AuthSession } from '../models/AuthSession.model.js';

const JWT_SECRET = process.env.JWT_SECRET;

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Expect "Bearer <token>"

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required. Please authenticate.',
      error: 'Missing Authorization header'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Session expired or invalid token',
        error: err.message
      });
    }
    if (!decoded.sessionId) {
      req.userId = decoded.userId;
      return next();
    }

    AuthSession.findActiveById(decoded.sessionId)
      .then(session => {
        if (!session || session.userId !== decoded.userId) {
          return res.status(401).json({
            success: false,
            message: 'Session expired or invalid token',
            error: 'Revoked session'
          });
        }
        req.userId = decoded.userId;
        req.sessionId = decoded.sessionId;
        next();
      })
      .catch(next);
  });
}

export default authenticateToken;
