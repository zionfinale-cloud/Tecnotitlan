const AUTH_COOKIE_NAME = 'tecnotitlan_session';
const AUTH_COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000;

const authCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: AUTH_COOKIE_MAX_AGE_MS,
});

export const setAuthCookie = (res, token) => res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());

export const clearAuthCookie = (res) => {
  const { maxAge, ...options } = authCookieOptions();
  res.clearCookie(AUTH_COOKIE_NAME, options);
};

export const readAuthCookieHeader = (header = '') => {
  const entry = String(header).split(';').map((item) => item.trim())
    .find((item) => item.startsWith(`${AUTH_COOKIE_NAME}=`));
  if (!entry) return null;
  try {
    return decodeURIComponent(entry.slice(AUTH_COOKIE_NAME.length + 1));
  } catch {
    return null;
  }
};

export { AUTH_COOKIE_MAX_AGE_MS, AUTH_COOKIE_NAME };
