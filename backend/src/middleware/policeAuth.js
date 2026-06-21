/**
 * Police API Key Authentication Middleware
 * 
 * Validates requests from the Police Dispatch Dashboard using a static API key.
 * This is a temporary access layer until full RBAC is implemented.
 * 
 * Usage: Set POLICE_API_KEY in your .env file, then send
 *        X-Police-API-Key: <key> header from the dashboard.
 */

const POLICE_API_KEY = process.env.POLICE_API_KEY;

export function policeAuth(req, res, next) {
  const apiKey = req.headers['x-police-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'Police API key required. Include X-Police-API-Key header.',
      error: 'Missing API Key'
    });
  }

  if (!POLICE_API_KEY || apiKey !== POLICE_API_KEY) {
    return res.status(403).json({
      success: false,
      message: 'Invalid police API key.',
      error: 'Forbidden'
    });
  }

  next();
}

export default policeAuth;
