/// <reference types="cypress" />

describe('Flujo de Autenticación', () => {
  // Usamos un email aleatorio para cada prueba de registro para evitar conflictos
  const randomEmail = `testuser_${Date.now()}@tecnotitlan.com`;
  const password = 'password123';

  beforeEach(() => {
    // Visitar la página principal antes de cada prueba
    cy.visit('/');
  });

  it('debería permitir a un nuevo usuario registrarse', () => {
    cy.contains('a', 'Iniciar Sesión').click();
    cy.contains('a', 'Regístrate').click();

    cy.url().should('include', '/register');

    cy.get('input[name="name"]').type('Test User');
    cy.get('input[name="email"]').type(randomEmail);
    cy.get('input[name="password"]').type(password);
    cy.get('input[name="confirmPassword"]').type(password);

    cy.get('button[type="submit"]').click();

    // Después del registro, debería redirigir a la página principal
    cy.url().should('eq', Cypress.config().baseUrl + '/');
    // Y el nombre del usuario debería aparecer en el header
    cy.get('#username').should('contain', 'Test User');
  });

  it('debería permitir a un usuario existente iniciar sesión y cerrar sesión', () => {
    // Asumimos que el usuario de la prueba anterior ya existe
    cy.contains('a', 'Iniciar Sesión').click();

    cy.url().should('include', '/login');

    cy.get('input[name="email"]').type(randomEmail);
    cy.get('input[name="password"]').type(password);

    cy.get('button[type="submit"]').click();

    // Debería redirigir a la página principal
    cy.url().should('eq', Cypress.config().baseUrl + '/');
    cy.get('#username').should('contain', 'Test User');

    // --- Prueba de Cierre de Sesión ---
    cy.get('#username').click(); // Abrir el menú desplegable
    cy.contains('a', 'Cerrar Sesión').click();

    // Debería volver a mostrar el botón de "Iniciar Sesión"
    cy.contains('a', 'Iniciar Sesión').should('be.visible');
  });

  it('debería mostrar un error con credenciales de login incorrectas', () => {
    cy.visit('/login');
    cy.get('input[name="email"]').type('wrong@email.com');
    cy.get('input[name="password"]').type('wrongpassword');
    cy.get('button[type="submit"]').click();

    // Debería mostrar una notificación de error
    cy.get('.notification.is-danger').should('be.visible').and('contain', 'Email o contraseña inválidos');
  });
});