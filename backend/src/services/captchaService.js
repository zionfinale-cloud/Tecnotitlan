import axios from 'axios';

/**
 * Verifica el token de reCAPTCHA v3 con la API de Google.
 * @param {string} token - El token generado en el frontend.
 * @returns {Promise<boolean>} - True si es humano (score >= 0.5), False si es bot.
 */
export const verifyCaptcha = async (token) => {
  if (!token) {
    console.error('Captcha Service: No se proporcionó token.');
    return false;
  }

  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  const url = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;

  try {
    const response = await axios.post(url);
    // v3 devuelve un score de 0.0 a 1.0. 0.5 es el estándar.
    return response.data.success && response.data.score >= 0.5;
  } catch (error) {
    console.error('Error verificando reCAPTCHA:', error);
    return false;
  }
};