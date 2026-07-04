import express from 'express';
import asyncHandler from 'express-async-handler';
import { handleStripeWebhook } from '../controllers/stripeWebhookController.js';

const router = express.Router();

router.post('/webhook', express.raw({ type: 'application/json' }), asyncHandler(handleStripeWebhook));

export default router;
