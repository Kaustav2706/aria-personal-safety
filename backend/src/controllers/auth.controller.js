import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.model.js';
import { AuthSession, hashRefreshToken } from '../models/AuthSession.model.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const JWT_SECRET = process.env.JWT_SECRET || 'aria_secure_jwt_secret_key_change_me';
const MIN_PASSWORD_LENGTH = 8;
const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function createRefreshToken() {
  return crypto.randomBytes(32).toString('base64url');
}

async function createAuthTokens(userId) {
  const refreshToken = createRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString();
  const session = await AuthSession.create({
    userId,
    refreshTokenHash: hashRefreshToken(refreshToken),
    expiresAt
  });
  const token = jwt.sign({ userId, sessionId: session.id }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  return { token, refreshToken };
}

export const register = asyncHandler(async (req, res) => {
  const { name, email, phone, password, emergencyContacts } = req.body;

  if (!name || !email || !phone || !password) {
    return res.status(400).json({
      success: false,
      message: 'Missing mandatory fields (name, email, phone, password)',
      error: 'Invalid Request Payload'
    });
  }

  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
      error: 'Invalid Request Payload'
    });
  }

  // Check if user exists
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User with this email already exists',
      error: 'Conflict'
    });
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const newUser = await User.create({
    name,
    email,
    phone,
    passwordHash,
    emergencyContacts: emergencyContacts || []
  });

  const { token, refreshToken } = await createAuthTokens(newUser.id);

  // Exclude password hash
  const { passwordHash: _, ...userWithoutPassword } = newUser;

  return res.status(201).json({
    success: true,
    message: 'Registration successful',
    token,
    refreshToken,
    user: userWithoutPassword
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Missing email or password',
      error: 'Invalid Credentials format'
    });
  }

  const user = await User.findByEmail(email);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
      error: 'Unauthorized'
    });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
      error: 'Unauthorized'
    });
  }

  const { token, refreshToken } = await createAuthTokens(user.id);

  const { passwordHash: _, ...userWithoutPassword } = user;

  return res.status(200).json({
    success: true,
    message: 'Login successful',
    token,
    refreshToken,
    user: userWithoutPassword
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken || typeof refreshToken !== 'string') {
    return res.status(401).json({
      success: false,
      message: 'Refresh token required',
      error: 'Unauthorized'
    });
  }

  const session = await AuthSession.findActiveByRefreshTokenHash(hashRefreshToken(refreshToken));
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token',
      error: 'Unauthorized'
    });
  }

  const replacementRefreshToken = createRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString();
  const rotatedSession = await AuthSession.rotate(
    session.id,
    hashRefreshToken(replacementRefreshToken),
    expiresAt
  );
  if (!rotatedSession) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token',
      error: 'Unauthorized'
    });
  }

  const token = jwt.sign(
    { userId: session.userId, sessionId: session.id },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
  return res.status(200).json({ success: true, token, refreshToken: replacementRefreshToken });
});

export const logout = asyncHandler(async (req, res) => {
  await AuthSession.revoke(req.sessionId);
  return res.status(200).json({ success: true, message: 'Logout successful' });
});

export const logoutAll = asyncHandler(async (req, res) => {
  await AuthSession.revokeAllForUser(req.userId);
  return res.status(200).json({ success: true, message: 'Signed out everywhere' });
});
