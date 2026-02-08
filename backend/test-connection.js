import net from 'net';
import { URL } from 'url';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Asegurar que cargamos el .env correcto (esté donde esté el script)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

function testPort(connectionString, label) {
    try {
        const url = new URL(connectionString);
        const port = url.port || 5432;
        const host = url.hostname;

        console.log(`[${label}] Probando conexión a ${host}:${port}...`);

        const socket = new net.Socket();
        socket.setTimeout(5000);

        socket.on('connect', () => {
            console.log(`✅ [${label}] ¡Conexión TCP exitosa al puerto ${port}!`);
            socket.destroy();
        });

        socket.on('timeout', () => {
            console.error(`❌ [${label}] Timeout: No se pudo conectar al puerto ${port} (Posible Firewall/IP Bloqueada)`);
            socket.destroy();
        });

        socket.on('error', (err) => {
            console.error(`❌ [${label}] Error: ${err.message}`);
        });

        socket.connect(port, host);
    } catch (e) {
        console.error(`⚠️ [${label}] URL inválida o no definida:`, e.message);
    }
}

console.log("--- DIAGNÓSTICO DE RED SUPABASE ---");
testPort(process.env.DATABASE_URL, 'DATABASE_URL (Pooler)');
testPort(process.env.DIRECT_URL, 'DIRECT_URL (Direct)');
