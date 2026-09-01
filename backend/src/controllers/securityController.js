import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js';
import { BadRequestError, UnauthorizedError } from '../utils/errorUtils.js';
import { decryptSecret, encryptSecret } from '../utils/secretCrypto.js';
import {
  buildOtpAuthUri,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  verifyTotp,
} from '../utils/totp.js';
import { generateAuthToken, verifyTwoFactorChallenge } from '../utils/authTokens.js';
import { toAuthUserPayload } from '../utils/permissionUtils.js';
import { setAuthCookie } from '../utils/authCookies.js';

const setupToken = (userId, secret) => jwt.sign(
  { id: userId, secret, scope: '2fa-setup' },
  process.env.JWT_SECRET,
  { expiresIn: '10m' },
);

const verifyPassword = async (user, password) => {
  if (!password || !await bcrypt.compare(password, user.password)) {
    throw new UnauthorizedError('La contrasena actual no coincide.');
  }
};

const verifyUserCode = (user, code) => {
  const secret = decryptSecret(user.twoFactorSecret);
  if (secret && verifyTotp(secret, code)) return { valid: true, recovery: false };
  const hash = hashRecoveryCode(code);
  const index = (user.twoFactorRecoveryCodes || []).indexOf(hash);
  return index >= 0 ? { valid: true, recovery: true, index } : { valid: false };
};

const consumeRecoveryCode = async (user, index) => {
  const remaining = [...(user.twoFactorRecoveryCodes || [])];
  remaining.splice(index, 1);
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorRecoveryCodes: remaining } });
  return remaining.length;
};

export const getSecurityStatus = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json({
    status: 'success',
    data: {
      twoFactorEnabled: Boolean(user?.twoFactorEnabled),
      recoveryCodesRemaining: user?.twoFactorRecoveryCodes?.length || 0,
    },
  });
});

export const beginTwoFactorSetup = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (user.twoFactorEnabled) throw new BadRequestError('El segundo factor ya esta activo.');
  await verifyPassword(user, req.body.password);
  const secret = generateTotpSecret();
  const otpAuthUri = buildOtpAuthUri({ secret, email: user.email });
  const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUri, { width: 280, margin: 1, errorCorrectionLevel: 'M' });
  res.json({ status: 'success', data: { secret, otpAuthUri, qrCodeDataUrl, setupToken: setupToken(user.id, secret) } });
});

export const enableTwoFactor = asyncHandler(async (req, res) => {
  let decoded;
  try {
    decoded = jwt.verify(req.body.setupToken, process.env.JWT_SECRET);
  } catch {
    throw new UnauthorizedError('La configuracion 2FA expiro. Inicia el proceso nuevamente.');
  }
  if (decoded.scope !== '2fa-setup' || decoded.id !== req.user.id || !verifyTotp(decoded.secret, req.body.code)) {
    throw new UnauthorizedError('El codigo de la aplicacion no es valido.');
  }
  const recoveryCodes = generateRecoveryCodes();
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: encryptSecret(decoded.secret),
      twoFactorRecoveryCodes: recoveryCodes.map(hashRecoveryCode),
      tokenVersion: { increment: 1 },
    },
  });
  setAuthCookie(res, generateAuthToken(user));
  res.json({
    status: 'success',
    message: 'Autenticacion de dos factores activada.',
    data: { recoveryCodes, twoFactorEnabled: true },
  });
});

export const disableTwoFactor = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { role: true } });
  if (!user.twoFactorEnabled) throw new BadRequestError('El segundo factor no esta activo.');
  if (user.role?.name && user.role.name !== 'USER') {
    throw new BadRequestError('El segundo factor es obligatorio para administradores y trabajadores.');
  }
  await verifyPassword(user, req.body.password);
  const verification = verifyUserCode(user, req.body.code);
  if (!verification.valid) throw new UnauthorizedError('El codigo 2FA o de recuperacion no es valido.');
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorRecoveryCodes: [],
      tokenVersion: { increment: 1 },
    },
  });
  setAuthCookie(res, generateAuthToken(updated));
  res.json({ status: 'success', message: 'Autenticacion de dos factores desactivada.', data: { twoFactorEnabled: false } });
});

export const regenerateRecoveryCodes = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user.twoFactorEnabled) throw new BadRequestError('Activa primero el segundo factor.');
  const verification = verifyUserCode(user, req.body.code);
  if (!verification.valid) throw new UnauthorizedError('El codigo 2FA o de recuperacion no es valido.');
  const recoveryCodes = generateRecoveryCodes();
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorRecoveryCodes: recoveryCodes.map(hashRecoveryCode) } });
  res.json({ status: 'success', data: { recoveryCodes } });
});

export const completeTwoFactorLogin = asyncHandler(async (req, res) => {
  let decoded;
  try {
    decoded = verifyTwoFactorChallenge(req.body.challengeToken);
  } catch {
    throw new UnauthorizedError('El reto de seguridad expiro. Inicia sesion nuevamente.');
  }
  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    include: {
      role: { include: { permissions: { select: { id: true, name: true, description: true } } } },
      permissionGrants: { include: { permission: { select: { id: true, name: true, description: true } } } },
      permissionDenies: { include: { permission: { select: { id: true, name: true, description: true } } } },
    },
  });
  if (!user?.twoFactorEnabled || decoded.ver !== user.tokenVersion) throw new UnauthorizedError('El reto de seguridad ya no es valido.');
  req.auditActor = user;
  const verification = verifyUserCode(user, req.body.code);
  if (!verification.valid) throw new UnauthorizedError('El codigo 2FA o de recuperacion no es valido.');
  let recoveryCodesRemaining = user.twoFactorRecoveryCodes.length;
  if (verification.recovery) recoveryCodesRemaining = await consumeRecoveryCode(user, verification.index);
  setAuthCookie(res, generateAuthToken(user));
  res.json({
    status: 'success',
    data: { ...toAuthUserPayload(user), recoveryCodesRemaining },
  });
});
