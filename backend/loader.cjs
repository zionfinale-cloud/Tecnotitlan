// Este archivo sirve de puente para que cPanel (CommonJS) pueda cargar la App (ES Modules)
async function loadApp() {
    await import('./src/index.js');
}
loadApp();