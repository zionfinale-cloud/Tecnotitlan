import crypto from 'crypto';
import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js';
import { BadRequestError, NotFoundError } from '../utils/errorUtils.js';
import { CONDITIONS, DISPOSITIONS, normalizeEvidence, validateInspectionDecision } from '../utils/returnInspectionRules.js';

const caseInclude = {
  order: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
    },
  },
  claim: { select: { id: true, externalClaimId: true, returnId: true, returnStatus: true, returnTrackingNumber: true } },
  items: {
    include: {
      orderItem: { select: { id: true, name: true, qty: true, image: true, unitCost: true, price: true } },
      product: { select: { id: true, sku: true, name: true, countInStock: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
};

const createCaseNumber = () => `DEV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
const text = (value, max = 5000) => String(value || '').trim().slice(0, max) || null;

const getReturnInspectionCases = asyncHandler(async (req, res) => {
  const status = text(req.query.status, 40);
  const cases = await prisma.returnInspectionCase.findMany({
    where: status ? { status } : undefined,
    include: caseInclude,
    orderBy: [{ status: 'asc' }, { receivedAt: 'desc' }],
    take: 250,
  });
  const stats = {
    total: cases.length,
    quarantinedCases: cases.filter((entry) => entry.status !== 'FINALIZED').length,
    quarantinedUnits: cases.filter((entry) => entry.status !== 'FINALIZED').reduce((sum, entry) => sum + entry.items.reduce((itemSum, item) => itemSum + item.receivedQty, 0), 0),
    readyToFinalize: cases.filter((entry) => entry.status === 'READY_FOR_DECISION').length,
    finalized: cases.filter((entry) => entry.status === 'FINALIZED').length,
  };
  res.json({ status: 'success', data: { cases, stats } });
});

const getReturnCandidates = asyncHandler(async (req, res) => {
  const [claims, orders] = await Promise.all([
    prisma.meliClaim.findMany({
      where: {
        returnInspection: null,
        OR: [{ returnId: { not: null } }, { returnStatus: { not: null } }, { inspectionStatus: { in: ['IN_TRANSIT', 'RECEIVED'] } }],
      },
      include: { order: { include: { orderItems: { include: { product: { select: { id: true, sku: true, name: true } } } } } } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    prisma.order.findMany({
      where: { status: { in: ['SHIPPED', 'DELIVERED', 'CANCELLED'] } },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        orderItems: { include: { product: { select: { id: true, sku: true, name: true } } } },
        returnInspections: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 150,
    }),
  ]);
  res.json({ status: 'success', data: { claims, orders } });
});

const receiveReturnInspection = asyncHandler(async (req, res) => {
  const { orderId, claimId, quarantineLocation, packageCondition, sealedPackage, receptionEvidence, notes } = req.body;
  if (!orderId) throw new BadRequestError('Selecciona el pedido recibido.');
  if (!text(quarantineLocation, 120)) throw new BadRequestError('Indica la ubicacion fisica de cuarentena.');
  if (!Array.isArray(req.body.items) || req.body.items.length === 0) throw new BadRequestError('Captura al menos una pieza recibida.');
  const normalizedReceptionEvidence = normalizeEvidence(receptionEvidence);
  if (normalizedReceptionEvidence.length === 0) throw new BadRequestError('Agrega al menos una fotografia del paquete al momento de recibirlo.');

  const returnCase = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { orderItems: { include: { product: { select: { id: true } } } } },
    });
    if (!order) throw new NotFoundError('Pedido no encontrado.');
    const claim = claimId ? await tx.meliClaim.findUnique({ where: { id: claimId } }) : null;
    if (claimId && !claim) throw new NotFoundError('Reclamo no encontrado.');
    if (claim?.orderId && claim.orderId !== order.id) throw new BadRequestError('El reclamo no pertenece al pedido seleccionado.');

    const requested = new Map();
    for (const item of req.body.items) {
      const receivedQty = Number(item.receivedQty);
      if (!item.orderItemId || !Number.isInteger(receivedQty) || receivedQty <= 0) throw new BadRequestError('Las cantidades recibidas deben ser enteros mayores a cero.');
      if (requested.has(item.orderItemId)) throw new BadRequestError('No dupliques productos en la recepcion.');
      requested.set(item.orderItemId, { ...item, receivedQty });
    }

    const previous = await tx.returnInspectionItem.groupBy({
      by: ['orderItemId'],
      where: { orderItemId: { in: [...requested.keys()] } },
      _sum: { receivedQty: true },
    });
    const previousByItem = new Map(previous.map((entry) => [entry.orderItemId, entry._sum.receivedQty || 0]));
    const createItems = [];
    for (const [orderItemId, received] of requested) {
      const orderItem = order.orderItems.find((entry) => entry.id === orderItemId);
      if (!orderItem) throw new BadRequestError('Una pieza no pertenece al pedido seleccionado.');
      if ((previousByItem.get(orderItemId) || 0) + received.receivedQty > orderItem.qty) {
        throw new BadRequestError(`La recepcion de ${orderItem.name} supera las ${orderItem.qty} pieza(s) vendidas.`);
      }
      createItems.push({
        orderItemId,
        productId: orderItem.productId,
        expectedQty: orderItem.qty,
        receivedQty: received.receivedQty,
        serialNumbers: Array.isArray(received.serialNumbers) ? received.serialNumbers.map((value) => String(value).trim()).filter(Boolean).slice(0, received.receivedQty) : undefined,
      });
    }

    const created = await tx.returnInspectionCase.create({
      data: {
        caseNumber: createCaseNumber(),
        source: claim ? 'MERCADOLIBRE' : 'MANUAL',
        status: 'QUARANTINED',
        quarantineLocation: text(quarantineLocation, 120),
        packageCondition: text(packageCondition, 100),
        sealedPackage: typeof sealedPackage === 'boolean' ? sealedPackage : null,
        receptionEvidence: normalizedReceptionEvidence,
        notes: text(notes),
        receivedById: req.user.id,
        receivedBy: req.user.email,
        orderId: order.id,
        claimId: claim?.id,
        items: { create: createItems },
      },
      include: caseInclude,
    });
    if (claim) {
      await tx.meliClaim.update({ where: { id: claim.id }, data: { inspectionStatus: 'RECEIVED', internalStatus: 'INSPECTION' } });
      await tx.meliClaimActivity.create({
        data: { claimId: claim.id, action: 'RETURN_QUARANTINED', actorId: req.user.id, actorName: req.user.email, details: { caseNumber: created.caseNumber, quarantineLocation: created.quarantineLocation } },
      });
    }
    return created;
  });
  res.status(201).json({ status: 'success', message: 'Devolucion recibida y aislada en cuarentena. El stock vendible no cambio.', data: { case: returnCase } });
});

const updateReturnInspectionItem = asyncHandler(async (req, res) => {
  const current = await prisma.returnInspectionItem.findUnique({ where: { id: req.params.itemId }, include: { inspectionCase: true } });
  if (!current || current.caseId !== req.params.caseId) throw new NotFoundError('Pieza de inspeccion no encontrada.');
  if (current.inspectionCase.status === 'FINALIZED') throw new BadRequestError('El expediente ya fue finalizado y no puede modificarse.');

  const condition = String(req.body.condition || current.condition);
  const disposition = String(req.body.disposition || current.disposition);
  const inspectedQty = req.body.inspectedQty === undefined ? current.inspectedQty : Number(req.body.inspectedQty);
  const evidenceUrls = req.body.evidenceUrls === undefined ? normalizeEvidence(current.evidenceUrls) : normalizeEvidence(req.body.evidenceUrls);
  const notes = req.body.notes === undefined ? current.notes : text(req.body.notes);
  const checklist = req.body.checklist === undefined ? current.checklist : req.body.checklist;
  const validationError = validateInspectionDecision({ receivedQty: current.receivedQty, inspectedQty, condition, disposition, evidenceUrls, notes, checklist });
  if (validationError) throw new BadRequestError(validationError);

  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.returnInspectionItem.update({
      where: { id: current.id },
      data: {
        inspectedQty,
        condition: CONDITIONS.has(condition) ? condition : current.condition,
        disposition: DISPOSITIONS.has(disposition) ? disposition : current.disposition,
        evidenceUrls,
        checklist: checklist && typeof checklist === 'object' ? checklist : undefined,
        notes,
        serialNumbers: req.body.serialNumbers === undefined ? undefined : (Array.isArray(req.body.serialNumbers) ? req.body.serialNumbers.map((value) => String(value).trim()).filter(Boolean).slice(0, current.receivedQty) : []),
      },
    });
    const siblings = await tx.returnInspectionItem.findMany({ where: { caseId: current.caseId } });
    const ready = siblings.every((entry) => entry.inspectedQty === entry.receivedQty && entry.condition !== 'PENDING' && entry.disposition !== 'HOLD');
    await tx.returnInspectionCase.update({ where: { id: current.caseId }, data: { status: ready ? 'READY_FOR_DECISION' : 'INSPECTING' } });
    return updated;
  });
  res.json({ status: 'success', message: 'Inspeccion guardada. La pieza permanece en cuarentena.', data: { item } });
});

const finalizeReturnInspection = asyncHandler(async (req, res) => {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "return_inspection_cases" WHERE id = ${req.params.caseId} FOR UPDATE`;
    const returnCase = await tx.returnInspectionCase.findUnique({ where: { id: req.params.caseId }, include: { items: { include: { product: true } }, claim: true } });
    if (!returnCase) throw new NotFoundError('Expediente de devolucion no encontrado.');
    if (returnCase.status === 'FINALIZED') return { returnCase, restoredUnits: returnCase.items.filter((item) => item.disposition === 'RESTOCK').reduce((sum, item) => sum + item.releasedQty, 0), alreadyFinalized: true };

    for (const item of returnCase.items) {
      const validationError = validateInspectionDecision(item);
      if (validationError || item.disposition === 'HOLD') throw new BadRequestError(validationError || 'Todas las piezas necesitan un destino final.');
    }

    let restoredUnits = 0;
    for (const item of returnCase.items) {
      if (item.disposition === 'RESTOCK') {
        const existingMovement = await tx.inventoryMovement.findFirst({ where: { type: 'RETURN_IN', referenceType: 'RETURN_INSPECTION', referenceId: item.id } });
        if (!existingMovement) {
          const product = await tx.product.update({
            where: { id: item.productId },
            data: { countInStock: { increment: item.receivedQty } },
            select: { countInStock: true },
          });
          const stockAfter = product.countInStock;
          const stockBefore = stockAfter - item.receivedQty;
          await tx.inventoryMovement.create({
            data: {
              type: 'RETURN_IN', productId: item.productId, quantity: item.receivedQty,
              unitCost: item.product.costPrice || 0, totalCost: item.receivedQty * (item.product.costPrice || 0),
              channel: 'WEB', stockBefore, stockAfter, referenceType: 'RETURN_INSPECTION', referenceId: item.id,
              notes: `Reintegracion aprobada desde ${returnCase.caseNumber}. Condicion: ${item.condition}.`, createdById: req.user.id,
            },
          });
          restoredUnits += item.receivedQty;
        }
      }
      await tx.returnInspectionItem.update({ where: { id: item.id }, data: { releasedQty: item.receivedQty, releasedAt: new Date() } });
    }

    const finalized = await tx.returnInspectionCase.update({
      where: { id: returnCase.id },
      data: { status: 'FINALIZED', finalizedAt: new Date(), finalizedById: req.user.id, finalizedBy: req.user.email },
      include: caseInclude,
    });
    if (returnCase.claimId) {
      const allSellable = returnCase.items.every((item) => item.disposition === 'RESTOCK');
      const hasIncomplete = returnCase.items.some((item) => ['INCOMPLETE', 'WRONG_ITEM'].includes(item.condition));
      await tx.meliClaim.update({ where: { id: returnCase.claimId }, data: { inspectionStatus: allSellable ? 'SELLABLE' : hasIncomplete ? 'INCOMPLETE' : 'DAMAGED' } });
      await tx.meliClaimActivity.create({
        data: { claimId: returnCase.claimId, action: 'RETURN_INSPECTION_FINALIZED', actorId: req.user.id, actorName: req.user.email, details: { caseNumber: returnCase.caseNumber, restoredUnits, dispositions: returnCase.items.map((item) => ({ productId: item.productId, quantity: item.receivedQty, disposition: item.disposition })) } },
      });
    }
    return { returnCase: finalized, restoredUnits, alreadyFinalized: false };
  });
  res.json({ status: 'success', message: result.alreadyFinalized ? 'El expediente ya estaba finalizado; no se duplico inventario.' : `Dictamen final aplicado. ${result.restoredUnits} pieza(s) regresaron a stock vendible.`, data: result });
});

export { getReturnInspectionCases, getReturnCandidates, receiveReturnInspection, updateReturnInspectionItem, finalizeReturnInspection };
