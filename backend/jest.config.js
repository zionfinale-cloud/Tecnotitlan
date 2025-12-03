module.exports = {
  // Indica que el entorno de prueba es Node.js
  testEnvironment: 'node',

  // Patrón para encontrar los archivos de prueba.
  testMatch: ['**/tests/**/*.test.js'],

  // Aumentar el timeout para pruebas que interactúan con la base de datos.
  testTimeout: 30000,

  // No transformar nada en node_modules, ya que Babel se encargará del código fuente.
  transformIgnorePatterns: ['/node_modules/'],

  // Usar Babel para transformar archivos .js y .jsx
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
  },
  // No necesitamos un archivo de setup por ahora, lo mantenemos limpio.
};
