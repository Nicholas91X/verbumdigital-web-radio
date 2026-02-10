/**
 * Mock ST1 (smixRest) server
 * Simulates the ST1 hardware device for local testing
 * 
 * Endpoints match Svilen's smixRest API:
 *   GET  /api/device/st1/status → { state, current_time }
 *   GET  /api/device/st1/setup  → { stream_url }
 *   POST /api/device/st1/setup  → { stream_url }
 *   POST /api/device/st1/play   → { success: true }
 *   POST /api/device/st1/stop   → { success: true }
 */

const http = require('http');

const PORT = 8085;

// Device state
let state = {
    state: 'noid',       // 'noid' | 'stopped' | 'streaming'
    current_time: 0,
    stream_url: '',
};

let timer = null;

function parseBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch { resolve({}); }
        });
    });
}

function json(res, data, status = 200) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        });
        return res.end();
    }

    const url = req.url;
    const method = req.method;

    // GET /api/device/st1/status
    if (url === '/api/device/st1/status' && method === 'GET') {
        return json(res, { state: state.state, current_time: state.current_time });
    }

    // GET /api/device/st1/setup
    if (url === '/api/device/st1/setup' && method === 'GET') {
        return json(res, { stream_url: state.stream_url });
    }

    // POST /api/device/st1/setup
    if (url === '/api/device/st1/setup' && method === 'POST') {
        const body = await parseBody(req);
        state.stream_url = body.stream_url || '';
        state.state = 'stopped';
        console.log(`[ST1] Setup: ${state.stream_url}`);
        return json(res, { stream_url: state.stream_url });
    }

    // POST /api/device/st1/play
    if (url === '/api/device/st1/play' && method === 'POST') {
        if (!state.stream_url) {
            return json(res, { success: false, error: 'No stream URL configured' }, 400);
        }
        state.state = 'streaming';
        state.current_time = 0;
        // Simulate elapsed time
        if (timer) clearInterval(timer);
        timer = setInterval(() => { state.current_time++; }, 1000);
        console.log(`[ST1] ▶ Streaming started`);
        return json(res, { success: true });
    }

    // POST /api/device/st1/stop
    if (url === '/api/device/st1/stop' && method === 'POST') {
        const elapsed = state.current_time;
        state.state = 'stopped';
        state.current_time = 0;
        if (timer) { clearInterval(timer); timer = null; }
        console.log(`[ST1] ■ Streaming stopped (${elapsed}s)`);
        return json(res, { success: true });
    }

    // 404
    json(res, { error: 'Not found' }, 404);
});

server.listen(PORT, () => {
    console.log(`\n  🔧 Mock ST1 (smixRest) running on http://localhost:${PORT}`);
    console.log(`  Endpoints:`);
    console.log(`    GET  /api/device/st1/status`);
    console.log(`    GET  /api/device/st1/setup`);
    console.log(`    POST /api/device/st1/setup  { stream_url }`);
    console.log(`    POST /api/device/st1/play`);
    console.log(`    POST /api/device/st1/stop\n`);
});
