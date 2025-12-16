import pkg from 'whatsapp-web.js';
import { getConfig } from './configService.js';

// The 'whatsapp-web.js' library is a CommonJS module.
// To use named exports like 'Client' and 'LocalAuth' in an ES module,
// we must import the default export and then destructure it.
const { Client, LocalAuth } = pkg;
let client;
let io; // Referencia al servidor de Socket.IO
let status = {
  isAuthenticated: false,
  qrCode: '',
  message: 'Initializing...'
};

/**
 * Inicializa el cliente de WhatsApp.
 * Esta función ahora se llama bajo demanda desde un controlador.
 */
const initializeWhatsAppClient = () => {
  if (client) {
    console.log('[WHATSAPP] Client already initialized or in process.');
    // Si ya hay un cliente, podría estar en proceso de conexión.
    // Devolvemos el estado actual para que el frontend se actualice.
    if (io) io.emit('whatsapp_status', status);
    return;
  }

  console.log('[WHATSAPP] Initializing WhatsApp client...');
  client = new Client({
    // Opciones para Puppeteer. 'headless: true' es para que no se abra una ventana del navegador.
    // 'args' son para asegurar compatibilidad en servidores (especialmente Linux).
    puppeteer: {
      headless: true, // Modo headless estándar
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      // CRÍTICO: En producción, esta opción evita que Puppeteer descargue Chromium,
      // lo que nos ahorra +500MB y soluciona el error 'no space left on device'.
      // Usaremos una versión ligera que viene con el sistema base del contenedor.
      executablePath: '/usr/bin/chromium-browser'
    },
    authStrategy: new LocalAuth({
      // Especifica una carpeta para la sesión para evitar que se cree en la raíz
      dataPath: 'wwebjs_auth'
    }),
  });

  client.on('qr', (qr) => {
    status = { isAuthenticated: false, qrCode: qr, message: 'QR Code received, please scan.' };
    console.log('[WHATSAPP] QR RECEIVED. Emitting to client.');
    // En lugar de mostrarlo en la terminal, lo emitimos por WebSocket.
    if (io) io.emit('whatsapp_qr', qr);
    if (io) io.emit('whatsapp_status', status);
  });

  client.on('authenticated', () => {
    status = { isAuthenticated: true, qrCode: '', message: 'Client is authenticated!' };
    console.log('[WHATSAPP] Authenticated successfully.');
    if (io) io.emit('whatsapp_status', status);
  });

  client.on('ready', () => {
    status = { isAuthenticated: true, qrCode: '', message: 'WhatsApp client is ready!' };
    console.log('[WHATSAPP] Client is ready!');
    if (io) io.emit('whatsapp_status', status);
  });

  client.on('auth_failure', msg => {
    status = { isAuthenticated: false, qrCode: '', message: `Authentication failure: ${msg}` };
    console.error('[WHATSAPP] AUTHENTICATION FAILURE', msg);
    if (io) io.emit('whatsapp_status', status);
    destroyClient(); // Limpiar el cliente fallido
  });

  client.on('disconnected', (reason) => {
    status = { isAuthenticated: false, qrCode: '', message: `Client was logged out: ${reason}` };
    console.log('[WHATSAPP] Client was logged out', reason);
    if (io) io.emit('whatsapp_status', status);
    destroyClient(); // Limpiar el cliente
  });

  client.initialize().catch(error => {
    console.error('[WHATSAPP] Initialization failed', error);
    status = { isAuthenticated: false, qrCode: '', message: `Initialization failed: ${error.message}` };
    if (io) io.emit('whatsapp_status', status);
    destroyClient();
  });
};

/**
 * Destruye y limpia la instancia del cliente de WhatsApp.
 */
const destroyClient = async () => {
  if (client) {
    console.log('[WHATSAPP] Destroying client...');
    try {
      await client.destroy();
    } catch (error) {
      console.error('[WHATSAPP] Error destroying client:', error);
    } finally {
      client = null;
      status = { isAuthenticated: false, qrCode: '', message: 'Client disconnected.' };
      if (io) io.emit('whatsapp_status', status);
      console.log('[WHATSAPP] Client destroyed.');
    }
  }
};

const getWhatsAppStatus = () => status;
const sendMessageToAdmin = async (message) => {
  if (!client || !status.isAuthenticated) {
    console.error('[WHATSAPP] Cannot send message, client is not ready or authenticated.');
    return;
  }
  const config = getConfig();
  const adminNumber = config.ADMIN_WHATSAPP_NUMBER;
  if (!adminNumber) {
    console.error('[WHATSAPP] ADMIN_WHATSAPP_NUMBER no está definido en la configuración.');
    return;
  }
  const chatId = `${adminNumber}@c.us`;
  try {
    await client.sendMessage(chatId, message);
    console.log(`[WHATSAPP] Notification sent to admin: ${message}`);
  } catch (error) {
    console.error(`[WHATSAPP] Failed to send message to ${chatId}`, error);
  }
};

/**
 * Envía un mensaje de WhatsApp a un número de cliente específico.
 * @param {string} customerPhone - El número de teléfono del cliente en formato '521...'.
 * @param {string} message - El mensaje a enviar.
 */
const sendCustomerNotification = async (customerPhone, message) => {
  if (!client || !status.isAuthenticated) {
    console.log('[WHATSAPP] Cliente no listo, no se puede enviar notificación al cliente.');
    return;
  }
  if (!customerPhone) {
    console.log('[WHATSAPP] No se proporcionó número de teléfono del cliente para la notificación.');
    return;
  }
  // Formatear a ID de chat (ej: 5212221234567@c.us)
  const chatId = `${customerPhone.replace(/[^0-9]/g, '')}@c.us`;
  await client.sendMessage(chatId, message);
  console.log(`[WHATSAPP] Notificación enviada al cliente ${chatId}`);
};

const setSocketIO = (socketIO) => {
  io = socketIO;
};

const isClientReady = () => client && status.isAuthenticated;

export {
  initializeWhatsAppClient,
  destroyClient,
  getWhatsAppStatus,
  sendMessageToAdmin,
  sendCustomerNotification,
  isClientReady,
  setSocketIO,
};
