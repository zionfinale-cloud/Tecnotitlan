import crypto from 'crypto';
import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js';

const clean = (value, max) => String(value || '').trim().slice(0, max) || null;
const classifySource = (referrerHost, campaign) => {
  if (campaign) return 'CAMPAIGN';
  if (!referrerHost) return 'DIRECT';
  if (/google|bing|yahoo|duckduckgo/i.test(referrerHost)) return 'SEARCH';
  if (/facebook|instagram|tiktok|twitter|x\.com|linkedin|youtube/i.test(referrerHost)) return 'SOCIAL';
  return 'REFERRAL';
};
const deviceFamily = (ua = '') => /bot|crawler|spider/i.test(ua) ? 'BOT' : /mobile|android|iphone/i.test(ua) ? 'MOBILE' : /tablet|ipad/i.test(ua) ? 'TABLET' : 'DESKTOP';

const recordPageView = asyncHandler(async (req, res) => {
  const path = clean(req.body.path, 300);
  const userAgent = String(req.headers['user-agent'] || '');
  if (!path || !path.startsWith('/') || path.startsWith('/admin') || deviceFamily(userAgent) === 'BOT') return res.status(204).send();
  let referrerHost = null;
  try { referrerHost = req.body.referrer ? new URL(req.body.referrer).hostname.slice(0, 180) : null; } catch { referrerHost = null; }
  const campaign = clean(req.body.campaign, 120);
  const day = new Date().toISOString().slice(0, 10);
  const visitorHash = crypto.createHash('sha256').update(`${process.env.JWT_SECRET || 'tecnotitlan'}|${day}|${req.ip}|${userAgent}`).digest('hex');
  const recent = await prisma.pageView.findFirst({ where: { visitorHash, path, occurredAt: { gte: new Date(Date.now() - 30000) } }, select: { id: true } });
  if (!recent) await prisma.pageView.create({ data: {
    path, visitorHash, referrerHost, source: classifySource(referrerHost, campaign), campaign,
    country: clean(req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'], 8),
    region: clean(req.headers['cf-region-code'] || req.headers['x-vercel-ip-country-region'], 40), device: deviceFamily(userAgent),
  } });
  res.status(204).send();
});

const getAnalyticsDashboard = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90);
  const since = new Date(Date.now() - days * 86400000);
  const views = await prisma.pageView.findMany({ where: { occurredAt: { gte: since } }, orderBy: { occurredAt: 'asc' }, take: 50000 });
  const today = new Date().toISOString().slice(0, 10);
  const countBy = (field, fallback = 'Desconocido') => Object.entries(views.reduce((result, view) => { const key = view[field] || fallback; result[key] = (result[key] || 0) + 1; return result; }, {})).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  const dailyMap = views.reduce((result, view) => { const key = view.occurredAt.toISOString().slice(0, 10); result[key] = (result[key] || 0) + 1; return result; }, {});
  res.json({ status: 'success', data: {
    summary: { views: views.length, visitors: new Set(views.map((view) => view.visitorHash)).size, viewsToday: views.filter((view) => view.occurredAt.toISOString().slice(0, 10) === today).length, pagesPerVisitor: views.length ? Math.round(views.length * 10 / new Set(views.map((view) => view.visitorHash)).size) / 10 : 0 },
    topPages: countBy('path').slice(0, 10), sources: countBy('source').slice(0, 10), countries: countBy('country', 'No disponible').slice(0, 10), referrers: countBy('referrerHost', 'Directo').slice(0, 10), devices: countBy('device').slice(0, 10),
    daily: Object.entries(dailyMap).map(([date, count]) => ({ date, count })), periodDays: days,
  } });
});

export { recordPageView, getAnalyticsDashboard, classifySource, deviceFamily };
