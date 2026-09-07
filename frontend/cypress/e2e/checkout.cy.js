/// <reference types="cypress" />

describe('Flujo de compra', () => {
  it('permite avanzar del carrito a la direccion de envio', () => {
    cy.intercept('GET', '**/api/users/session', {
      status: 'success',
      data: { id: 'customer-1', name: 'Cliente', email: 'cliente@example.com', role: 'USER', permissions: [], twoFactorEnabled: false },
    });
    cy.intercept('GET', '**/api/settings/public', { status: 'success', data: [] });
    cy.intercept('POST', '**/api/analytics/view', { status: 'success' });
    cy.visit('/cart', {
      onBeforeLoad(window) {
        window.localStorage.setItem('cartItems', JSON.stringify([{
          product: 'product-1', sku: 'TEST-001', name: 'Producto de prueba', price: 499,
          image: '/images/logo.webp', qty: 1, countInStock: 5, availableStock: 5,
        }]));
      },
    });
    cy.contains('button', 'Proceder al Pago').click();
    cy.url().should('include', '/shipping');
  });
});
