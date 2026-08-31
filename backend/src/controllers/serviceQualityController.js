import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js';
import { BadRequestError, NotFoundError } from '../utils/errorUtils.js';
import { getInboxItemsSnapshot } from './unifiedInboxController.js';
import { scanSlaAlerts, scanCriticalInboxEscalations } from '../services/serviceQualityService.js';

const SOURCE_TYPES = new Set(['WHATSAPP', 'SUPPORT', 'MELI_QUESTION', 'MELI_POST_SALE', 'MELI_CLAIM', 'TECATL']);
const clean = (value, max = 5000) => String(value || '').trim().slice(0, max);

const getServiceQualityDashboard = asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [items, reviews] = await Promise.all([
    getInboxItemsSnapshot(),
    prisma.inboxQualityReview.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 300 }),
  ]);
  const measurable = items.filter((item) => item.sla?.firstResponseMet !== null);
  const byChannel = items.reduce((result, item) => {
    const key = item.channel;
    const current = result[key] || { total: 0, breached: 0, atRisk: 0, measured: 0, met: 0, responseSum: 0 };
    current.total += 1;
    if (item.sla?.state === 'BREACHED') current.breached += 1;
    if (item.sla?.state === 'AT_RISK') current.atRisk += 1;
    if (item.sla?.firstResponseMet !== null) { current.measured += 1; current.met += item.sla.firstResponseMet ? 1 : 0; current.responseSum += item.sla.firstResponseMinutes || 0; }
    result[key] = current;
    return result;
  }, {});
  Object.values(byChannel).forEach((metric) => {
    metric.compliance = metric.measured ? Math.round(metric.met * 100 / metric.measured) : null;
    metric.avgFirstResponseMinutes = metric.measured ? Math.round(metric.responseSum / metric.measured) : null;
  });
  const averageQuality = reviews.length ? Math.round(reviews.reduce((sum, review) => sum + review.overallScore, 0) * 10 / reviews.length) / 10 : null;
  res.json({ status: 'success', data: {
    summary: {
      active: items.filter((item) => item.canReply).length,
      breached: items.filter((item) => item.sla?.state === 'BREACHED').length,
      atRisk: items.filter((item) => item.sla?.state === 'AT_RISK').length,
      compliance: measurable.length ? Math.round(measurable.filter((item) => item.sla.firstResponseMet).length * 100 / measurable.length) : null,
      avgFirstResponseMinutes: measurable.length ? Math.round(measurable.reduce((sum, item) => sum + item.sla.firstResponseMinutes, 0) / measurable.length) : null,
      averageQuality, reviews: reviews.length,
    }, byChannel, alerts: items.filter((item) => ['BREACHED', 'AT_RISK'].includes(item.sla?.state)).slice(0, 50), reviews: reviews.slice(0, 50),
  } });
});

const getResponseTemplates = asyncHandler(async (req, res) => {
  const templates = await prisma.inboxResponseTemplate.findMany({ where: req.query.all === 'true' ? {} : { isActive: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  res.json({ status: 'success', data: { templates } });
});
const createResponseTemplate = asyncHandler(async (req, res) => {
  const name = clean(req.body.name, 120); const body = clean(req.body.body);
  if (!name || !body) throw new BadRequestError('Nombre y contenido son obligatorios.');
  if (req.body.sourceType && !SOURCE_TYPES.has(req.body.sourceType)) throw new BadRequestError('Canal invalido.');
  const template = await prisma.inboxResponseTemplate.create({ data: { name, body, sourceType: req.body.sourceType || null, category: clean(req.body.category, 50) || 'GENERAL', createdBy: req.user.email } });
  res.status(201).json({ status: 'success', data: { template } });
});
const updateResponseTemplate = asyncHandler(async (req, res) => {
  const current = await prisma.inboxResponseTemplate.findUnique({ where: { id: req.params.id } });
  if (!current) throw new NotFoundError('Plantilla no encontrada.');
  const template = await prisma.inboxResponseTemplate.update({ where: { id: current.id }, data: {
    ...(req.body.name !== undefined ? { name: clean(req.body.name, 120) } : {}), ...(req.body.body !== undefined ? { body: clean(req.body.body) } : {}),
    ...(req.body.category !== undefined ? { category: clean(req.body.category, 50) || 'GENERAL' } : {}), ...(req.body.isActive !== undefined ? { isActive: Boolean(req.body.isActive) } : {}),
    ...(req.body.sourceType !== undefined ? { sourceType: req.body.sourceType || null } : {}),
  } });
  res.json({ status: 'success', data: { template } });
});
const reviewInboxQuality = asyncHandler(async (req, res) => {
  const { sourceType, sourceId } = req.params;
  if (!SOURCE_TYPES.has(sourceType)) throw new BadRequestError('Canal invalido.');
  const scores = ['clarity', 'empathy', 'accuracy', 'resolution', 'compliance'].reduce((result, field) => ({ ...result, [field]: Number(req.body[field]) }), {});
  if (Object.values(scores).some((score) => !Number.isInteger(score) || score < 1 || score > 5)) throw new BadRequestError('Cada criterio debe calificarse del 1 al 5.');
  const overallScore = Object.values(scores).reduce((sum, score) => sum + score, 0) / 5;
  const review = await prisma.inboxQualityReview.create({ data: { sourceType, sourceId, ...scores, overallScore, notes: clean(req.body.notes) || null, reviewerId: req.user.id, reviewer: req.user.email } });
  res.status(201).json({ status: 'success', data: { review } });
});
const scanServiceQualityAlerts = asyncHandler(async (req, res) => res.json({ status: 'success', data: {
  sla: await scanSlaAlerts(), critical: await scanCriticalInboxEscalations(),
} }));

export { getServiceQualityDashboard, getResponseTemplates, createResponseTemplate, updateResponseTemplate, reviewInboxQuality, scanServiceQualityAlerts };
