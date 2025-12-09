// d:\PowerUpMovil\backend\src\utils\logger.js

// Colores para la consola
const RESET = "\x1b[0m";
const FG_RED = "\x1b[31m";
const FG_GREEN = "\x1b[32m";
const FG_YELLOW = "\x1b[33m";
const FG_BLUE = "\x1b[34m";
const FG_CYAN = "\x1b[36m";

const logger = {
  info: (message) => console.log(`${FG_CYAN}[INFO] ${message}${RESET}`),
  success: (message) => console.log(`${FG_GREEN}[SUCCESS] ${message}${RESET}`),
  warn: (message) => console.log(`${FG_YELLOW}[WARN] ${message}${RESET}`),
  error: (message, error) => {
    console.error(`${FG_RED}[ERROR] ${message}${RESET}`, error || '');
  },
  debug: (message, data) => {
    console.log(`${FG_BLUE}[DEBUG] ${message}${RESET}`, data !== undefined ? data : '');
  },
  request: (req) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  }
};

export default logger;