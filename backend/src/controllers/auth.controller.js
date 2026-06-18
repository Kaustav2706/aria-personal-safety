import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.model.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const JWT_SECRET = process.env.JWT_SECRET || 'aria_secure_jwt_secret_key_change_me';

export const register = asyncHandler(async (req, res) => {
  const { name, email, phone, password, emergencyContacts } = req.body;

  if (!name || !email || !phone || !password) {
    return res.status(400).json({
      success: false,
      message: 'Missing mandatory fields (name, email, phone, password)',
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

  // Sign token
  const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: '7d' });

  // Exclude password hash
  const { passwordHash: _, ...userWithoutPassword } = newUser;

  return res.status(201).json({
    success: true,
    message: 'Registration successful',
    token,
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

  // Sign token
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

  const { passwordHash: _, ...userWithoutPassword } = user;

  return res.status(200).json({
    success: true,
    message: 'Login successful',
    token,
    user: userWithoutPassword
  });
});
