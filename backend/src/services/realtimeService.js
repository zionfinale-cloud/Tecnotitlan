import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';
import { readAuthCookieHeader } from '../utils/authCookies.js';

let socketServer = null;

export const configureRealtime = (io) => {
  socketServer = io;
  io.use(async (socket, next) => {
    try {
      const legacyToken = process.env.NODE_ENV === 'production' ? null : socket.handshake.auth?.token;
      const token = readAuthCookieHeader(socket.handshake.headers?.cookie) || legacyToken;
      if (!token) {
        socket.join('public');
        return next();
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if ((decoded.scope && decoded.scope !== 'auth')) return next(new Error('AUTH_INVALID'));
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, tokenVersion: true, role: { select: { name: true } } },
      });
      if (!user || Number(decoded.ver || 0) !== user.tokenVersion) return next(new Error('AUTH_INVALID'));
      socket.data.user = user;
      socket.join('authenticated');
      socket.join(`user:${user.id}`);
      if (user.role?.name !== 'USER') socket.join('admins');
      if (user.role?.name === 'SUPER_ADMIN') socket.join('super-admins');
      return next();
    } catch (error) {
      return next(new Error('AUTH_INVALID'));
    }
  });
  io.on('connection', (socket) => {
    socket.emit('realtime:ready', { connectedAt: new Date().toISOString() });
  });
};

export const emitRealtime = (topic, action, data = {}, { room = 'admins' } = {}) => {
  if (!socketServer) return false;
  socketServer.to(room).emit('data:changed', {
    topic,
    action,
    data,
    occurredAt: new Date().toISOString(),
  });
  return true;
};

export const emitRealtimeMany = (topics, action, data = {}, options = {}) => {
  [...new Set(topics)].forEach((topic) => emitRealtime(topic, action, data, options));
};

export const getRealtimeServer = () => socketServer;

export const logRealtimeError = (error) => logger.error('[Realtime]', error.message);
