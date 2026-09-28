import http from 'http';
import httpProxy from 'http-proxy';
import { readFileSync, writeFileSync, existsSync, watch, unlinkSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROXY_PORT = 4096;
const CONFIG_PATH = join(__dirname, 'config.json');
const CONTINUE_FLAG = join(__dirname, '.continue');
const RESTART_LOCK = join(__dirname, '.restart-lock');
const HEALTH_CHECK_INTERVAL = 5000;    // 5s (was 3s) — less aggressive
const HEALTH_TIMEOUT = 5000;           // 5s (was 2s) — OpenCode needs more time during heavy ops
const FAILOVER_THRESHOLD = 2;          // Require 2 consecutive failures before failover
const CONTINUE_RETRY_DELAY = 3000;     // 3s retry delay for continue messages
const CONTINUE_MAX_RETRIES = 2;        // Max retries for continue messages

const wrapperHTML = readFileSync(join(__dirname, 'wrapper.html'), 'utf8');

// --- Dynamic config ---
let config = { activePort: 4097, standbyPort: 4098 };
let activeHealthy = true;
let lastFailover = 0;
const COOLDOWN = 15000;                // 15s cooldown (was 10s) — prevent ping-pong
let consecutiveFailures = 0;           // Track consecutive health check failures

function loadConfig() {
    try {
        const raw = readFileSync(CONFIG_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.activePort !== config.activePort) {
            console.log(`[PROXY] Config changed: active ${config.activePort} → ${parsed.activePort}`);
            activeHealthy = true;
            consecutiveFailures = 0; // Reset failures on config change
        }
        config = parsed;
    } catch (e) {
        console.error('[PROXY] Config read error:', e.message);
    }
}

loadConfig();
watch(CONFIG_PATH, () => {
    console.log('[PROXY] Config file changed, reloading...');
    loadConfig();
});

// --- Atomic config write (write temp → rename) ---
function atomicWriteConfig(newConfig) {
    const tmpPath = CONFIG_PATH + '.tmp';
    try {
        writeFileSync(tmpPath, JSON.stringify(newConfig, null, 2));
        renameSync(tmpPath, CONFIG_PATH); // Atomic on Linux (same filesystem)
    } catch (e) {
        console.error(`[PROXY] Config write failed:`, e.message);
        // Cleanup temp file if rename failed
        try { unlinkSync(tmpPath); } catch {}
    }
}

// --- Health check with retry ---
function checkPort(port) {
    return new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}/`, {
            timeout: HEALTH_TIMEOUT,
            auth: 'opencode:__OPENCODE_PASSWORD__',
        }, (res) => { res.resume(); resolve(res.statusCode === 200); });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
    });
}

async function healthCheck() {
    const now = Date.now();
    if (now - lastFailover < COOLDOWN) return;

    // Skip failover during blue-green restart
    if (existsSync(RESTART_LOCK)) {
        const healthy = await checkPort(config.activePort);
        if (!activeHealthy && healthy) {
            console.log(`[PROXY] Active (port ${config.activePort}) recovered ✅ (restart lock held)`);
            activeHealthy = true;
            consecutiveFailures = 0;
        }
        return;
    }

    const healthy = await checkPort(config.activePort);
    if (healthy) {
        if (!activeHealthy) {
            console.log(`[PROXY] Active (port ${config.activePort}) recovered ✅`);
            activeHealthy = true;
        }
        consecutiveFailures = 0; // Reset on success
        return;
    }

    // Count consecutive failures — require THRESHOLD before failover
    consecutiveFailures++;
    if (consecutiveFailures < FAILOVER_THRESHOLD) {
        console.log(`[PROXY] Active (port ${config.activePort}) check failed (${consecutiveFailures}/${FAILOVER_THRESHOLD}) — waiting for next check`);
        return; // Don't failover yet — wait for next check
    }

    console.log(`[PROXY] Active (port ${config.activePort}) UNHEALTHY ❌ (${consecutiveFailures} consecutive failures)`);
    activeHealthy = false;
    consecutiveFailures = 0; // Reset after failover decision

    const standbyHealthy = await checkPort(config.standbyPort);
    if (standbyHealthy) {
        console.log(`[PROXY] FAILOVER → standby (port ${config.standbyPort})`);
        failover(config.standbyPort);
    } else {
        console.log(`[PROXY] Both dead! Starting standby...`);
        startInstance(config.standbyPort);
        setTimeout(async () => {
            if (await checkPort(config.standbyPort)) {
                failover(config.standbyPort);
            }
        }, 5000);
    }
}

function failover(newPort) {
    const newConfig = { activePort: newPort, standbyPort: config.activePort };
    atomicWriteConfig(newConfig);
    lastFailover = Date.now();
    console.log(`[PROXY] Config updated: active=${newPort}`);
}

function startInstance(port) {
    const service = port === 4097 ? 'opencode' : 'opencode2';
    try {
        execSync(`systemctl start ${service}`, { timeout: 10000 });
        console.log(`[PROXY] Started ${service} on port ${port}`);
    } catch (e) {
        console.error(`[PROXY] Failed to start ${service}:`, e.message);
    }
}

setInterval(healthCheck, HEALTH_CHECK_INTERVAL);

// --- WebSocket proxy (for future use) ---
const proxy = httpProxy.createProxyServer({ changeOrigin: true, ws: true });

proxy.on('error', (err, req, res) => {
    console.error(`[PROXY] WebSocket proxy error → port ${config.activePort}:`, err.message);
});

const STATIC_FILES = {
    '/manifest.json': { file: 'manifest.json', type: 'application/json' },
    '/sw.js': { file: 'sw.js', type: 'application/javascript' },
    '/icon-192.png': { file: 'icon-192.png', type: 'image/png' },
    '/icon-512.png': { file: 'icon-512.png', type: 'image/png' },
};

function sendJSON(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

// --- Continue message sender with retry ---
function sendContinueMessage(sessionId, message, targetPort, retries = 0) {
    const postData = JSON.stringify({
        parts: [{ type: 'text', text: message }],
    });

    const apiReq = http.request({
        hostname: '127.0.0.1',
        port: targetPort,
        path: `/session/${sessionId}/message`,
        method: 'POST',
        auth: 'opencode:__OPENCODE_PASSWORD__',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 120000,
    }, (apiRes) => {
        apiRes.resume();
        if (apiRes.statusCode >= 200 && apiRes.statusCode < 300) {
            console.log(`[PROXY] Continue message accepted (${apiRes.statusCode}) for session ${sessionId}`);
        } else {
            console.error(`[PROXY] Continue rejected: OpenCode ${apiRes.statusCode} for session ${sessionId}`);
        }
    });

    apiReq.on('error', (e) => {
        console.error(`[PROXY] Continue request error (attempt ${retries + 1}):`, e.message);
        // Retry on socket hang-up or connection error
        if (retries < CONTINUE_MAX_RETRIES) {
            console.log(`[PROXY] Retrying continue message in ${CONTINUE_RETRY_DELAY}ms...`);
            setTimeout(() => {
                // Try the other port on retry (in case failover happened)
                const retryPort = (targetPort === config.activePort) ? config.activePort : config.activePort;
                sendContinueMessage(sessionId, message, retryPort, retries + 1);
            }, CONTINUE_RETRY_DELAY);
        } else {
            console.error(`[PROXY] Continue message failed after ${CONTINUE_MAX_RETRIES + 1} attempts for session ${sessionId}`);
        }
    });

    apiReq.write(postData);
    apiReq.end();
}

// --- SSE Keepalive Heartbeat (prevents Cloudflare timeout) ---
const SSE_HEARTBEAT_INTERVAL = 15000; // 15s — Cloudflare free tier kills idle SSE after ~100s

function proxyWithSSEHeartbeat(req, res) {
    const target = `http://127.0.0.1:${config.activePort}`;

    // Intercept the response to detect SSE streams
    const proxyReq = http.request({
        hostname: '127.0.0.1',
        port: config.activePort,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `127.0.0.1:${config.activePort}` },
    }, (proxyRes) => {
        const contentType = proxyRes.headers['content-type'] || '';
        const isSSE = contentType.includes('text/event-stream');

        // Forward response headers to client
        res.writeHead(proxyRes.statusCode, proxyRes.headers);

        if (isSSE) {
            console.log(`[PROXY] SSE detected on ${req.url} — heartbeats enabled (every ${SSE_HEARTBEAT_INTERVAL}ms)`);

            // Inject keepalive heartbeats for SSE
            const heartbeat = setInterval(() => {
                if (!res.writableEnded) {
                    res.write(':keepalive\n\n'); // SSE comment — clients ignore lines starting with ':'
                }
            }, SSE_HEARTBEAT_INTERVAL);

            // Cleanup on close
            res.on('close', () => {
                clearInterval(heartbeat);
                if (!proxyRes.destroyed) proxyRes.destroy();
            });

            proxyRes.on('data', (chunk) => {
                if (!res.writableEnded) res.write(chunk);
            });

            proxyRes.on('end', () => {
                clearInterval(heartbeat);
                if (!res.writableEnded) res.end();
            });
        } else {
            // Non-SSE: forward as-is
            proxyRes.on('data', (chunk) => {
                if (!res.writableEnded) res.write(chunk);
            });
            proxyRes.on('end', () => {
                if (!res.writableEnded) res.end();
            });
        }
    });

    proxyReq.on('error', (err) => {
        console.error(`[PROXY] SSE proxy error → port ${config.activePort}:`, err.message);
        if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end('Backend unavailable');
        }
    });

    // Forward request body
    req.on('data', (chunk) => proxyReq.write(chunk));
    req.on('end', () => proxyReq.end());
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // --- API: restart status ---
    if (pathname === '/api/restart-status') {
        if (existsSync(CONTINUE_FLAG)) {
            try {
                const flag = JSON.parse(readFileSync(CONTINUE_FLAG, 'utf8'));
                sendJSON(res, 200, { needsContinue: true, sessionId: flag.sessionId });
            } catch {
                sendJSON(res, 200, { needsContinue: true, sessionId: null });
            }
        } else {
            sendJSON(res, 200, { needsContinue: false });
        }
        return;
    }

    // --- API: consume continue flag ---
    if (pathname === '/api/restart-consume' && req.method === 'POST') {
        if (existsSync(CONTINUE_FLAG)) {
            try {
                const flag = JSON.parse(readFileSync(CONTINUE_FLAG, 'utf8'));
                unlinkSync(CONTINUE_FLAG);
                sendJSON(res, 200, { consumed: true, sessionId: flag.sessionId });
            } catch {
                sendJSON(res, 200, { consumed: false });
            }
        } else {
            sendJSON(res, 200, { consumed: false });
        }
        return;
    }

    // --- API: send continue message to OpenCode (fire-and-forget with retry) ---
    if (pathname === '/api/continue' && req.method === 'POST') {
        let body = '';
        req.on('data', (c) => body += c);
        req.on('end', () => {
            try {
                const { sessionId, message } = JSON.parse(body);
                if (!sessionId || !message) {
                    sendJSON(res, 400, { ok: false, error: 'Missing sessionId or message' });
                    return;
                }

                const targetPort = config.activePort;

                // Reply IMMEDIATELY — don't wait for OpenCode streaming response
                sendJSON(res, 200, { ok: true, targetPort, mode: 'fire-and-forget' });
                console.log(`[PROXY] Continue message fired to session ${sessionId} on port ${targetPort}`);

                // Fire POST with retry support
                sendContinueMessage(sessionId, message, targetPort);
            } catch (e) {
                sendJSON(res, 400, { ok: false, error: e.message });
            }
        });
        return;
    }

    // --- API: proxy health ---
    if (pathname === '/api/health') {
        const activeOk = await checkPort(config.activePort);
        sendJSON(res, 200, {
            active: { port: config.activePort, healthy: activeOk },
            standby: { port: config.standbyPort },
        });
        return;
    }

    // --- Static files ---
    if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
        });
        res.end(wrapperHTML);
        return;
    }

    const staticFile = STATIC_FILES[pathname];
    if (staticFile) {
        const filePath = join(__dirname, staticFile.file);
        if (existsSync(filePath)) {
            const data = readFileSync(filePath);
            res.writeHead(200, {
                'Content-Type': staticFile.type,
                'Cache-Control': pathname === '/manifest.json' ? 'no-cache, no-store' : 'public, max-age=31536000',
            });
            res.end(data);
            return;
        }
    }

    // --- Proxy with SSE heartbeat (detects SSE and injects keepalive) ---
    proxyWithSSEHeartbeat(req, res);
});

server.on('upgrade', (req, socket, head) => {
    const target = `http://127.0.0.1:${config.activePort}`;
    proxy.ws(req, socket, head, { target });
});

server.listen(PROXY_PORT, '0.0.0.0', () => {
    console.log(`[PROXY] Running on port ${PROXY_PORT}`);
    console.log(`[PROXY] Routing to OpenCode on port ${config.activePort}`);
    console.log(`[PROXY] Health check: every ${HEALTH_CHECK_INTERVAL}ms, timeout ${HEALTH_TIMEOUT}ms`);
    console.log(`[PROXY] Failover threshold: ${FAILOVER_THRESHOLD} consecutive failures, cooldown ${COOLDOWN}ms`);
});
