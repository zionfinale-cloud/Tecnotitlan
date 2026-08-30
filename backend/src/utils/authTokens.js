import jwt from 'jsonwebtoken';

const secret = () => process.env.JWT_SECRET;

export const generateAuthToken = (user) => jwt.sign(
  { id: user.id, ver: Number(user.tokenVersion || 0), scope: 'auth' },
  secret(),
  { expiresIn: '30d' },
);

export const generateTwoFactorChallenge = (user) => jwt.sign(
  { id: user.id, ver: Number(user.tokenVersion || 0), scope: '2fa' },
  secret(),
  { expiresIn: '5m' },
);

export const verifyTwoFactorChallenge = (token) => {
  const decoded = jwt.verify(token, secret());
  if (decoded.scope !== '2fa') throw new Error('Reto 2FA invalido.');
  return decoded;
};
