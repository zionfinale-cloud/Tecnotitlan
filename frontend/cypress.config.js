const { defineConfig } = require('cypress');

module.exports = defineConfig({
  allowCypressEnv: false,
  e2e: {
    supportFile: false,
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    // CRÍTICO: Le decimos a Cypress que busque las pruebas en esta carpeta
    specPattern: 'cypress/e2e/**/*.cy.js',
  },
});
