import { Router } from 'express';
import { register, login, refresh, logout, logoutAll } from '../controllers/auth.controller.js';
import { loginRateLimiter, registrationRateLimiter } from '../middleware/rateLimiter.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

// POST /api/auth/register
router.post('/register', registrationRateLimiter, register);

// POST /api/auth/login
router.post('/login', loginRateLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', authenticateToken, logout);
router.post('/logout-all', authenticateToken, logoutAll);

export default router;
