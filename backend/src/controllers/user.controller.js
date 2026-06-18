import { User } from '../models/User.model.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const getProfile = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User profile not found',
      error: 'Not Found'
    });
  }

  const { passwordHash: _, ...userWithoutPassword } = user;
  return res.status(200).json({
    success: true,
    user: userWithoutPassword
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { name, phone, emergencyContacts } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User profile not found',
      error: 'Not Found'
    });
  }

  const updates = {};
  if (name) updates.name = name;
  if (phone) updates.phone = phone;
  if (emergencyContacts) updates.emergencyContacts = emergencyContacts;

  const updatedUser = await User.update(userId, updates);
  const { passwordHash: _, ...userWithoutPassword } = updatedUser;

  return res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    user: userWithoutPassword
  });
});
