import express from 'express';
import { sendPublicMessage } from '../controllers/tecatlController.js';

const router = express.Router();

router.post('/message', sendPublicMessage);

export default router;
