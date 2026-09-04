import { Router } from 'express';
import { register, login } from '../controllers/auth.controller.js';
import { loginRateLimiter, registrationRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// POST /api/auth/register
router.post('/register', registrationRateLimiter, register);

// POST /api/auth/login
router.post('/login', loginRateLimiter, login);

export default router;
