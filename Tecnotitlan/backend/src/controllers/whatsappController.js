import asyncHandler from 'express-async-handler';
import * as whatsappService from '../services/whatsappService.js';

/**
 * @desc    Get the current status of the WhatsApp client
 * @route   GET /api/integrations/whatsapp/status
 * @access  Private/Admin
 */
const getStatus = asyncHandler(async (req, res) => {
  const status = whatsappService.getWhatsAppStatus();
  res.json(status);
});

/**
 * @desc    Initialize the WhatsApp client connection
 * @route   POST /api/integrations/whatsapp/initialize
 * @access  Private/Admin
 */
const initializeClient = asyncHandler(async (req, res) => {
  whatsappService.initializeWhatsAppClient();
  res.status(202).json({ message: 'WhatsApp client initialization started.' });
});

/**
 * @desc    Logout and destroy the WhatsApp client session
 * @route   POST /api/integrations/whatsapp/logout
 * @access  Private/Admin
 */
const logoutClient = asyncHandler(async (req, res) => {
  await whatsappService.destroyClient();
  res.status(200).json({ message: 'WhatsApp client logged out successfully.' });
});

export { getStatus, initializeClient, logoutClient };