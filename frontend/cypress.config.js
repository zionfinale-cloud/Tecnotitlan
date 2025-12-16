const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    // CRÍTICO: Le decimos a Cypress que busque las pruebas en esta carpeta
    specPattern: 'cypress/e2e/**/*.cy.js',
    // Desactivamos la búsqueda del archivo de soporte, ya que no lo usamos.
    supportFile: false,
  },
});