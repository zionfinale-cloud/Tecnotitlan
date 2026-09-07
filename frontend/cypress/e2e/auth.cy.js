/// <reference types="cypress" />

describe('Flujo de autenticacion', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/users/session', { status: 'success', data: null });
    cy.intercept('GET', '**/api/settings/public', { status: 'success', data: [] });
    cy.intercept('POST', '**/api/analytics/view', { status: 'success' });
    cy.visit('/');
  });

  it('permite iniciar un registro con todos los datos obligatorios', () => {
    cy.get('a[aria-label="Ingresar a Mi cuenta"]').click();
    cy.contains('a', 'Registrate').click();
    cy.url().should('include', '/register');
    cy.get('#name').type('Cliente de prueba');
    cy.get('#email').type('cliente@example.com');
    cy.get('#phone').type('3481510949');
    cy.get('#password').type('ClaveSegura123!');
    cy.get('#confirmPassword').type('ClaveSegura123!');
    cy.contains('button', 'Registrarme').should('be.enabled');
  });
});
