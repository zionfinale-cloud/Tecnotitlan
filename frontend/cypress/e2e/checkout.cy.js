/// <reference types="cypress" />

describe('Flujo de compra', () => {
  it('permite avanzar del carrito a la direccion de envio', () => {
    cy.visit('/');
    cy.get('a[href^="/product/"]').first().click();
    cy.contains('button', /carrito/i).click();
    cy.visit('/cart');
    cy.contains('button', /pago|checkout/i).click();
    cy.url().should('include', '/shipping');
  });
});
