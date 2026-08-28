import test from 'node:test';
import assert from 'node:assert/strict';

import { getClaimDueDate } from '../src/services/mercadoLibreService.js';

test('prioriza la fecha limite oficial del detalle del reclamo', () => {
  const dueDate = getClaimDueDate(
    { players: [{ role: 'respondent', available_actions: [{ due_date: '2026-09-02T10:00:00Z' }] }] },
    { due_date: '2026-09-01T10:00:00Z' },
  );
  assert.equal(dueDate.toISOString(), '2026-09-01T10:00:00.000Z');
});

test('usa el vencimiento mas cercano de las acciones disponibles', () => {
  const dueDate = getClaimDueDate({
    players: [{
      role: 'respondent',
      available_actions: [
        { action: 'open_dispute', due_date: '2026-09-03T10:00:00Z' },
        { action: 'send_message', due_date: '2026-09-01T10:00:00Z' },
      ],
    }],
  });
  assert.equal(dueDate.toISOString(), '2026-09-01T10:00:00.000Z');
});
