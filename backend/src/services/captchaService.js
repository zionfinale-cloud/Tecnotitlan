import axios from 'axios';
import { config } from '../config/env.js';

const MIN_RECAPTCHA_SCORE = 0.5;

export const verifyCaptcha = async (token) => {
  if (!token) {
    return { success: false, reason: 'missing-token' };
  }

  if (!config.RECAPTCHA_SECRET_KEY) {
    return { success: false, reason: 'missing-secret' };
  }

  try {
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      new URLSearchParams({
        secret: config.RECAPTCHA_SECRET_KEY,
        response: token,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { success, score, action, 'error-codes': errorCodes } = response.data;

    return {
      success: Boolean(success && score >= MIN_RECAPTCHA_SCORE),
      score,
      action,
      errorCodes,
      reason: success ? 'low-score' : 'verification-failed',
    };
  } catch {
    return { success: false, reason: 'request-failed' };
  }
};
