/**
 * Police Dispatcher JWT Authentication Middleware
 *
 * Validates requests from the Police Dispatch Dashboard using the same JWT
 * infrastructure as regular users, but additionally enforces role='police'.
 *
 * Dispatchers must log in through POST /api/auth/login with a police account
 * (role='police') and send the returned token as:
 *   Authorization: Bearer <token>
 *
 * This eliminates the shared VITE_POLICE_API_KEY secret that was previously
 * baked into the browser bundle.
 */

import jwt from 'jsonwebtoken';
import { AuthSession } from '../models/AuthSession.model.js';

const JWT_SECRET = process.env.JWT_SECRET;

export async function policeAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Expect "Bearer <token>"

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in to the dispatch portal.',
      error: 'Missing Authorization header'
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: 'Session expired or invalid token. Please log in again.',
      error: err.message
    });
  }

  // Enforce police role — regular user tokens are rejected
  if (decoded.role !== 'police') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Police dispatcher account required.',
      error: 'Insufficient role'
    });
  }

  // Validate session is still active (not revoked)
  if (decoded.sessionId) {
    try {
      const session = await AuthSession.findActiveById(decoded.sessionId);
      if (!session || session.userId !== decoded.userId) {
        return res.status(401).json({
          success: false,
          message: 'Session expired or revoked. Please log in again.',
          error: 'Revoked session'
        });
      }
    } catch (err) {
      return next(err);
    }
  }

  req.userId = decoded.userId;
  req.sessionId = decoded.sessionId;
  req.userRole = decoded.role;
  next();
}

export default policeAuth;
