import { Router } from 'express';
import { getProfile, updateProfile } from '../controllers/user.controller.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

// GET /api/user/profile
router.get('/profile', authenticateToken, getProfile);

// PUT /api/user/profile
router.put('/profile', authenticateToken, updateProfile);

export default router;
