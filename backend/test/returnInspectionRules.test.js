import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvidence, validateInspectionDecision } from '../src/utils/returnInspectionRules.js';

const completeChecklist = {
  serialMatches: true,
  accessoriesComplete: false,
  powersOn: true,
  cosmeticOk: true,
  packageOk: false,
};

test('permite inspeccion parcial mientras la pieza sigue retenida', () => {
  const error = validateInspectionDecision({ receivedQty: 2, inspectedQty: 1, condition: 'PENDING', disposition: 'HOLD' });
  assert.equal(error, null);
});

test('bloquea un dictamen si no se inspeccionaron todas las piezas', () => {
  const error = validateInspectionDecision({ receivedQty: 2, inspectedQty: 1, condition: 'LIKE_NEW', disposition: 'RESTOCK', checklist: completeChecklist, notes: 'Inspeccion visual completa.' });
  assert.match(error, /todas las piezas/i);
});

test('exige checklist completo y evidencia o hallazgos detallados', () => {
  const missingChecklist = validateInspectionDecision({ receivedQty: 1, inspectedQty: 1, condition: 'DAMAGED', disposition: 'DISPOSE', checklist: {}, notes: 'Daño visible en carcasa.' });
  assert.match(missingChecklist, /lista de verificacion/i);
  const missingEvidence = validateInspectionDecision({ receivedQty: 1, inspectedQty: 1, condition: 'DAMAGED', disposition: 'DISPOSE', checklist: completeChecklist, notes: '' });
  assert.match(missingEvidence, /evidencia fotografica/i);
});

test('acepta un destino final documentado aunque el checklist contenga fallas', () => {
  const error = validateInspectionDecision({ receivedQty: 1, inspectedQty: 1, condition: 'INCOMPLETE', disposition: 'RETURN_SUPPLIER', checklist: completeChecklist, evidenceUrls: ['/uploads/evidencia.jpg'] });
  assert.equal(error, null);
});

test('impide reintegrar como vendible una pieza dañada o con controles críticos fallidos', () => {
  const damaged = validateInspectionDecision({ receivedQty: 1, inspectedQty: 1, condition: 'DAMAGED', disposition: 'RESTOCK', checklist: { ...completeChecklist, accessoriesComplete: true }, notes: 'Daño visible documentado.' });
  assert.match(damaged, /no puede regresar/i);
  const missingAccessories = validateInspectionDecision({ receivedQty: 1, inspectedQty: 1, condition: 'LIKE_NEW', disposition: 'RESTOCK', checklist: completeChecklist, notes: 'Faltan accesorios originales.' });
  assert.match(missingAccessories, /serie, los accesorios/i);
});

test('normaliza evidencia y limita el expediente a doce archivos', () => {
  const evidence = normalizeEvidence(Array.from({ length: 15 }, (_, index) => ` /img-${index}.jpg `));
  assert.equal(evidence.length, 12);
  assert.equal(evidence[0], '/img-0.jpg');
});
