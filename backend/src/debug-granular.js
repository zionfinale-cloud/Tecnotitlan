// backend/src/debug-granular.js

// STEP 0: Script Entry Point
// If you don't see this message, the Node.js process itself is failing to start.
console.log('\x1b[36m[DEBUG-GRANULAR] STEP 0: Node.js process started. Attempting to load modules...\x1b[0m');

try {
  // STEP 1: Load dotenv
  await import('dotenv/config');
  console.log('\x1b[32m[DEBUG-GRANULAR] STEP 1: SUCCESS - dotenv/config loaded.\x1b[0m');

  // STEP 2: Load logger
  const { default: logger } = await import('./utils/logger.js');
  console.log('\x1b[32m[DEBUG-GRANULAR] STEP 2: SUCCESS - logger loaded.\x1b[0m');

  // STEP 3: Load Prisma
  logger.info('[DEBUG-GRANULAR] STEP 3: Attempting to load Prisma...');
  const { default: prisma } = await import('./config/prisma.js');
  logger.success('[DEBUG-GRANULAR] STEP 3: SUCCESS - Prisma client imported.');

  // STEP 4: Load WhatsApp Service (Puppeteer)
  logger.info('[DEBUG-GRANULAR] STEP 4: Attempting to load whatsappService (this loads Puppeteer)...');
  await import('./services/whatsappService.js');
  logger.success('[DEBUG-GRANULAR] STEP 4: SUCCESS - whatsappService imported.');

  logger.success('\n[DEBUG-GRANULAR] ALL MAJOR MODULES LOADED. The crash is likely not from a direct import.');

} catch (error) {
  console.error('\x1b[31m[DEBUG-GRANULAR] A critical error occurred during module loading:\x1b[0m', error);
  process.exit(1);
}