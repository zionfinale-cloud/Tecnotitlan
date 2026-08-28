import test from 'node:test';
import assert from 'node:assert/strict';

import { getMeliDispatchDetails } from '../src/services/mercadoLibreService.js';

test('identifica entrega en un punto Places y conserva el nodo de origen', () => {
  const dispatch = getMeliDispatchDetails({
    id: 47874166286,
    logistic: { type: 'xd_drop_off' },
    origin: {
      node: 'MXP123',
      shipping_address: {
        address_line: 'Av. Reforma 100',
        city: { name: 'Ciudad de Mexico' },
        state: { name: 'CDMX' },
        zip_code: '06600',
      },
    },
  });

  assert.equal(dispatch.mode, 'drop_off_place');
  assert.equal(dispatch.title, 'Entrega en punto Mercado Libre');
  assert.equal(dispatch.originNode, 'MXP123');
  assert.equal(dispatch.originAddress.addressLine, 'Av. Reforma 100');
  assert.match(dispatch.detailsUrl, /47874166286/);
});

test('distingue recoleccion en domicilio de entrega en paqueteria', () => {
  assert.equal(
    getMeliDispatchDetails({ logistic_type: 'cross_docking' }).mode,
    'seller_pickup'
  );
  assert.equal(
    getMeliDispatchDetails({ logistic: { type: 'drop_off' } }).mode,
    'drop_off_carrier'
  );
});
