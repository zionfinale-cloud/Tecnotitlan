import express from 'express';
import {
  getStatus,
  handleMeliAuth,
  exchangeCodeForToken,
  handleWebhookNotification,
  getMeliOrders,
  disconnectMeli,
  getMeliItemDetails,
  syncStock,
} from '../controllers/mercadoLibreController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

// Ruta para verificar el estado de la conexión con Mercado Libre
router.get('/status', protect, checkPermission('integration:read'), getStatus);

// Ruta para iniciar la autenticación con Mercado Libre
router.get('/auth', protect, checkPermission('integration:update'), handleMeliAuth);

// Ruta para que Mercado Libre nos devuelva el código y lo intercambiemos por un token
router.post('/token', protect, checkPermission('integration:update'), exchangeCodeForToken);

// Ruta para desconectar la cuenta
router.delete('/disconnect', protect, checkPermission('integration:delete'), disconnectMeli);

// --- Rutas de Sincronización ---
// Obtener detalles de un item específico de Meli
router.get('/items/:meliItemId', protect, checkPermission('product:read'), getMeliItemDetails);
// Sincronizar el stock de un producto local a Meli
router.put('/products/:sku/sync', protect, checkPermission('product:update'), syncStock);

// Ruta para recibir las notificaciones (webhooks) de Mercado Libre
router.post('/notifications', handleWebhookNotification);

// Ruta para obtener la lista de pedidos de Mercado Libre desde nuestro panel
router.get('/orders', protect, checkPermission('order:read'), getMeliOrders);

export default router;
