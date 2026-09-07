/// <reference types="cypress" />

const settingsResponse = { status: 'success', data: [] };

describe('Navegación móvil', () => {
  beforeEach(() => {
    cy.viewport(390, 844);
    cy.intercept('GET', '**/api/settings/public', settingsResponse);
    cy.intercept('POST', '**/api/analytics/view', { status: 'success' });
  });

  it('mantiene visibles los accesos principales de la tienda y el contador del carrito', () => {
    cy.intercept('GET', '**/api/users/profile', { statusCode: 401, body: { message: 'Sin sesión' } });
    cy.visit('/', {
      onBeforeLoad(window) {
        window.localStorage.setItem('cartItems', JSON.stringify([{ product: 'demo', qty: 2 }]));
      },
    });

    cy.get('nav[aria-label="Navegación rápida de la tienda"]').should('be.visible').within(() => {
      cy.contains('Inicio').should('be.visible');
      cy.contains('Categorías').should('be.visible');
      cy.contains('Carrito').should('be.visible');
      cy.contains('Ingresar').should('be.visible');
      cy.contains('b', '2').should('be.visible');
    });
    cy.document().then((document) => expect(document.documentElement.scrollWidth).to.be.at.most(document.documentElement.clientWidth));
  });

  it('permite recorrer el panel con accesos rápidos y cerrar el menú con Escape', () => {
    cy.intercept('GET', '**/api/users/profile', {
      status: 'success',
      data: { id: 'admin-1', name: 'Administración', email: 'admin@tecnotitlan.com.mx', role: 'SUPER_ADMIN', permissions: [], twoFactorEnabled: true },
    });
    cy.intercept('GET', '**/api/my-work', {
      status: 'success',
      data: {
        summary: { pending: 0, ordersToPrepare: 0, urgentClaims: 0, unreadMessages: 0 },
        orders: [], claims: [], messages: { whatsapp: 0, questions: 0, postSale: 0, support: 0 },
      },
    });
    cy.intercept('GET', '**/api/integrations/whatsapp/chats', { status: 'success', data: [] });
    cy.intercept('GET', '**/api/mercadolibre/communications/counts', { status: 'success', data: { total: 0 } });
    cy.intercept('GET', '**/api/unified-inbox/counts', { status: 'success', data: { total: 0 } });
    cy.intercept('GET', '**/api/unified-inbox/critical-alerts', { status: 'success', data: { alerts: [] } });

    cy.visit('/admin/my-work');
    cy.get('nav[aria-label="Accesos rápidos administrativos"]').should('be.visible').within(() => {
      cy.contains('Mi trabajo').should('be.visible');
      cy.contains('Bandeja').should('be.visible');
      cy.contains('Pedidos').should('be.visible');
      cy.contains('Más').should('be.visible');
    });
    cy.get('button[aria-label="Abrir menú administrativo"]').click();
    cy.get('aside[aria-label="Navegación administrativa"]').should('be.visible');
    cy.get('body').type('{esc}');
    cy.get('aside[aria-label="Navegación administrativa"]').should('not.be.visible');
    cy.get('button[aria-label="Abrir menú administrativo"]').should('be.focused');
    cy.document().then((document) => expect(document.documentElement.scrollWidth).to.be.at.most(document.documentElement.clientWidth));
  });
});
