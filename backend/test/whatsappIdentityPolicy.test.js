import test from 'node:test';
import assert from 'node:assert/strict';

test('documenta politica WhatsApp segura para Técatl', () => {
  const lid = '123456789012345@lid';
  const phone = '3312345678';
  const normalize = (value = '') => {
    const raw = String(value || '').trim();
    if (/@(lid|g\.us|broadcast|newsletter)$/i.test(raw) || /^status@broadcast$/i.test(raw)) return null;
    const source = /@(s\.whatsapp\.net|c\.us)$/i.test(raw) ? raw.split('@')[0].split(':')[0] : raw;
    const digits = source.replace(/\D/g, '');
    if (digits.length >= 10) return `52${digits.slice(-10)}`;
    return digits || null;
  };

  assert.equal(normalize(phone), '523312345678');
  assert.equal(normalize('523312345678'), '523312345678');
  assert.equal(normalize(lid), null);
  assert.equal(normalize('120363421694494746@g.us'), null);
  assert.equal(normalize(phone).startsWith('521'), false);
});
