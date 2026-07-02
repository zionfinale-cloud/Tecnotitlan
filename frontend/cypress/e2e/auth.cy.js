/// <reference types="cypress" />

describe('Flujo de autenticacion', () => {
  const randomEmail = `testuser_${Date.now()}@tecnotitlan.com`;
  const password = 'password123';

  beforeEach(() => {
    cy.visit('/');
  });

  it('permite registrar un usuario nuevo', () => {
    cy.contains('a', 'Iniciar Sesion').click();
    cy.contains('a', 'Registrate').click();
    cy.url().should('include', '/register');
    cy.get('input[name="name"]').type('Test User');
    cy.get('input[name="email"]').type(randomEmail);
    cy.get('input[name="password"]').type(password);
    cy.get('input[name="confirmPassword"]').type(password);
    cy.get('button[type="submit"]').click();
    cy.url().should('eq', `${Cypress.config().baseUrl}/`);
  });
});
