import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'aria_secure_jwt_secret_key_change_me';

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
    req.userId = decoded.userId;
    next();
  });
}

export default authenticateToken;
