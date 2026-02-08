import axios from 'axios';
import { getConfig } from './configService.js';
import { UnauthorizedError, NotFoundError } from '../utils/errorUtils.js';
import logger from '../utils/logger.js';

const getPayPalApiBase = () => {
  const config = getConfig();
  return config.PAYPAL_MODE === 'sandbox'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';
};

/**
 * Obtiene un token de acceso de la API de PayPal usando las credenciales del servidor.
 * @returns {Promise<string>} El token de acceso.
 */
const getPayPalAccessToken = async () => {
  const config = getConfig();
  const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = config;

  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    logger.error('[PayPal Auth] Las credenciales de PayPal (Client ID o Secret) no están configuradas.');
    throw new Error('La configuración del servidor de PayPal está incompleta.');
  }

  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');

  try {
    const response = await axios.post(`${getPayPalApiBase()}/v1/oauth2/token`, 'grant_type=client_credentials', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
      },
    });
    return response.data.access_token;
  } catch (error) {
    logger.error('Error al obtener el token de PayPal:', error.response?.data || error.message);
    throw new UnauthorizedError('No se pudo autenticar con el servidor de PayPal.');
  }
};

/**
 * Verifica un pago de PayPal capturado, comparando estado y monto.
 * @param {string} paypalOrderID - El ID de la orden de PayPal que viene del frontend.
 * @param {number} expectedAmount - El monto total que se esperaba cobrar, desde nuestra base de datos.
 * @returns {Promise<boolean>} True si el pago es válido y coincide con el monto.
 */
const verifyPayPalPayment = async (paypalOrderID, expectedAmount) => {
  const accessToken = await getPayPalAccessToken();

  try {
    const response = await axios.get(`${getPayPalApiBase()}/v2/checkout/orders/${paypalOrderID}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const payPalOrder = response.data;

    // 1. Verificar que el estado de la orden de PayPal sea 'COMPLETED'.
    const isCompleted = payPalOrder.status === 'COMPLETED';
    if (!isCompleted) {
      logger.error(`[PayPal Verify] La orden de PayPal ${paypalOrderID} no está completada. Estado: ${payPalOrder.status}`);
      return false;
    }

    // 2. Verificar que el monto y la moneda de la captura coincidan con lo esperado.
    const capture = payPalOrder.purchase_units[0]?.payments?.captures?.[0];
    if (!capture) {
      logger.error(`[PayPal Verify] No se encontró una captura en la orden de PayPal ${paypalOrderID}.`);
      return false;
    }

    const paidAmount = parseFloat(capture.amount.value);
    const currency = capture.amount.currency_code;
    const expectedCurrency = getConfig().PAYPAL_CURRENCY || 'MXN';

    const amountMatches = Math.abs(paidAmount - expectedAmount) < 0.01; // Tolerancia para flotantes
    const currencyMatches = currency === expectedCurrency;

    if (!amountMatches || !currencyMatches) {
      logger.error(`[PayPal Verify] Discrepancia en el pago. Esperado: ${expectedAmount} ${expectedCurrency}. Recibido: ${paidAmount} ${currency}.`);
      return false;
    }

    return true;
  } catch (error) {
    logger.error(`[PayPal Verify] Error al verificar la orden ${paypalOrderID}:`, error.response?.data || error.message);
    return false;
  }
};

export { verifyPayPalPayment };