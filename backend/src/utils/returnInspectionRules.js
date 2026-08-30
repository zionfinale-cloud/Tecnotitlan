const CONDITIONS = new Set(['PENDING', 'SEALED_NEW', 'LIKE_NEW', 'USED_GOOD', 'DAMAGED', 'INCOMPLETE', 'WRONG_ITEM']);
const DISPOSITIONS = new Set(['HOLD', 'RESTOCK', 'REFURBISH', 'RETURN_SUPPLIER', 'DISPOSE']);
const CHECKLIST_FIELDS = ['serialMatches', 'accessoriesComplete', 'powersOn', 'cosmeticOk', 'packageOk'];

const normalizeEvidence = (value) => (Array.isArray(value) ? value : [])
  .map((entry) => String(entry || '').trim())
  .filter(Boolean)
  .slice(0, 12);

const validateInspectionDecision = ({ receivedQty, inspectedQty, condition, disposition, evidenceUrls, notes, checklist }) => {
  const received = Number(receivedQty);
  const inspected = Number(inspectedQty);
  if (!Number.isInteger(inspected) || inspected < 0 || inspected > received) {
    return 'La cantidad inspeccionada debe estar entre cero y la cantidad recibida.';
  }
  if (!CONDITIONS.has(condition)) return 'La condicion seleccionada no es valida.';
  if (!DISPOSITIONS.has(disposition)) return 'El destino seleccionado no es valido.';
  if (disposition !== 'HOLD') {
    if (inspected !== received) return 'Inspecciona todas las piezas recibidas antes de asignar un destino final.';
    if (condition === 'PENDING') return 'Selecciona la condicion fisica antes del dictamen.';
    const hasEvidence = normalizeEvidence(evidenceUrls).length > 0;
    const hasDetailedNotes = String(notes || '').trim().length >= 10;
    const hasChecklist = checklist && typeof checklist === 'object'
      && CHECKLIST_FIELDS.every((field) => typeof checklist[field] === 'boolean');
    if (!hasChecklist) return 'Completa toda la lista de verificacion antes del dictamen.';
    if (!hasEvidence && !hasDetailedNotes) return 'Agrega evidencia fotografica o una nota detallada de inspeccion.';
    if (disposition === 'RESTOCK') {
      if (!['SEALED_NEW', 'LIKE_NEW', 'USED_GOOD'].includes(condition)) {
        return 'Una pieza dañada, incompleta o incorrecta no puede regresar al inventario vendible.';
      }
      if (!checklist.serialMatches || !checklist.accessoriesComplete || !checklist.powersOn) {
        return 'Para reintegrar a bodega deben coincidir la serie, los accesorios y la prueba de funcionamiento.';
      }
    }
  }
  return null;
};

export { CONDITIONS, DISPOSITIONS, CHECKLIST_FIELDS, normalizeEvidence, validateInspectionDecision };
