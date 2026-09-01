import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getMyWork } from '../controllers/myWorkController.js';

const router = express.Router();
router.get('/', protect, getMyWork);
export default router;
