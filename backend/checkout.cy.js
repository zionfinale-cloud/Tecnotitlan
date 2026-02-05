/// <reference types="cypress" />

describe('Flujo de Compra Completo', () => {
  beforeEach(() => {
    // Iniciar sesión como un usuario de prueba antes de cada test
    // NOTA: Para un entorno de pruebas real, esto se haría programáticamente
    // a través de una llamada a la API para ser más rápido y robusto.
    cy.visit('/login');
    cy.get('input[name="email"]').type('test@example.com'); // Un usuario que ya debe existir en tu BD de prueba
    cy.get('input[name="password"]').type('password123');
    cy.get('button[type="submit"]').click();
    cy.url().should('not.include', '/login');
  });

  it('debería permitir a un usuario añadir un producto al carrito y proceder al checkout', () => {
    // 1. Ir a la página de inicio
    cy.visit('/');

    // 2. Hacer clic en el primer producto de la cuadrícula
    cy.get('.product-card').first().click();

    // 3. Añadir el producto al carrito
    cy.contains('button', 'Añadir al Carrito').click();

    // 4. Verificar que la notificación "Añadido al carrito" aparece
    cy.get('.add-to-cart-notification').should('be.visible');

    // 5. Ir al carrito
    cy.get('.cart-icon').click();
    cy.url().should('include', '/cart');

    // 6. Proceder al pago
    cy.contains('button', 'Proceder al Pago').click();
    cy.url().should('include', '/shipping');

    // 7. Llenar la dirección de envío
    cy.get('input[name="address"]').type('Calle Falsa 123');
    cy.get('input[name="city"]').type('Ciudad de Prueba');
    cy.get('input[name="postalCode"]').type('12345');
    cy.get('input[name="country"]').type('México');
    cy.contains('button', 'Continuar').click();

    // 8. Seleccionar método de pago
    cy.url().should('include', '/payment');
    cy.get('input[value="PayPal"]').check();
    cy.contains('button', 'Continuar').click();

    // 9. Revisar el pedido
    cy.url().should('include', '/placeorder');
    cy.contains('h2', 'Resumen del Pedido').should('be.visible');

    // Aquí no hacemos clic en "Realizar Pedido" para no crear pedidos reales en cada prueba.
    // La prueba finaliza verificando que se llegó a la última pantalla del checkout.
  });
});