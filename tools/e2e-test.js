#!/usr/bin/env node
/**
 * E2E ST1 Simulator — Full lifecycle test
 * 
 * Simulates the complete ST1 → Backend flow WITHOUT hardware:
 *   1. POST /device/validate       (ST1 identifies itself)
 *   2. POST /device/stream/started (creates DB session, church goes LIVE)
 *   3. [optional] FFmpeg audio → Icecast
 *   4. POST /device/stream/stopped (closes session, church back to STBY)
 * 
 * Usage:
 *   node tools/e2e-test.js                          # simulation (no audio)
 *   node tools/e2e-test.js --live                    # with real audio via FFmpeg
 *   node tools/e2e-test.js --serial SMIX-99999       # custom serial number
 *   node tools/e2e-test.js --duration 120            # stream for 120 seconds (default 30)
 *   node tools/e2e-test.js --live --duration 60      # combine options
 * 
 * Requires:
 *   - Backend running on BACKEND_URL (default http://localhost:8081)
 *   - DEVICE_API_KEY matching backend .env
 *   - [--live mode] FFmpeg installed and a machine+church with streaming_credentials in DB
 */

const http = require('http');
const https = require('https');
const { spawn } = require('child_process');

// ============================================
// CONFIGURATION — edit or override via env vars
// ============================================
const CONFIG = {
    BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:8081',
    API_PREFIX: '/api/v1',
    DEVICE_API_KEY: process.env.DEVICE_API_KEY || '1p5hZ4I4bokK4vUxm5D8mRvZZu8EMAYl',
    SERIAL_NUMBER: 'SMIX-001',
    STREAM_DURATION_SECS: 30,
    ICECAST_SOURCE_PASSWORD: process.env.ICECAST_SOURCE_PASSWORD || 'r0j1e0A8bx',
};

// ============================================
// CLI ARGS
// ============================================
const args = process.argv.slice(2);
const LIVE_MODE = args.includes('--live');

const serialIdx = args.indexOf('--serial');
if (serialIdx !== -1 && args[serialIdx + 1]) {
    CONFIG.SERIAL_NUMBER = args[serialIdx + 1];
}

const durationIdx = args.indexOf('--duration');
if (durationIdx !== -1 && args[durationIdx + 1]) {
    CONFIG.STREAM_DURATION_SECS = parseInt(args[durationIdx + 1], 10) || 30;
}

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
  📡 E2E ST1 Simulator — Full lifecycle test

  Usage:
    node tools/e2e-test.js [options]

  Options:
    --live                 Enable real audio streaming via FFmpeg to Icecast
    --serial <id>          Serial number of the machine (default: ${CONFIG.SERIAL_NUMBER})
    --duration <seconds>   How long to stream before stopping (default: ${CONFIG.STREAM_DURATION_SECS})
    --help, -h             Show this help

  Environment Variables:
    BACKEND_URL            Backend API URL (default: ${CONFIG.BACKEND_URL})
    DEVICE_API_KEY         ST1 device API key (default: from backend .env)
    ICECAST_SOURCE_PASSWORD  Icecast source password (default: r0j1e0A8bx)

  Examples:
    node tools/e2e-test.js                        # Quick simulation (30s, no audio)
    node tools/e2e-test.js --live --duration 60    # 60s with real audio
    node tools/e2e-test.js --serial SMIX-99999     # Test with different machine
`);
    process.exit(0);
}

// ============================================
// HELPERS
// ============================================

function request(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${CONFIG.BACKEND_URL}${CONFIG.API_PREFIX}${path}`);
        const isHttps = url.protocol === 'https:';
        const lib = isHttps ? https : http;

        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname,
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-Device-Key': CONFIG.DEVICE_API_KEY,
            },
        };

        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, body: json });
                } catch {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
}

const LOG = {
    step: (n, msg) => console.log(`\n  [${'●'.repeat(n)}${'○'.repeat(5 - n)}] Step ${n}/5 — ${msg}`),
    ok: (msg) => console.log(`       ✅ ${msg}`),
    fail: (msg) => console.log(`       ❌ ${msg}`),
    info: (msg) => console.log(`       ℹ️  ${msg}`),
    data: (obj) => console.log(`       📦 ${JSON.stringify(obj, null, 2).split('\n').join('\n       ')}`),
};

// ============================================
// MAIN FLOW
// ============================================

async function run() {
    console.log(`\n  ╔══════════════════════════════════════════╗`);
    console.log(`  ║   📡 E2E ST1 Simulator                   ║`);
    console.log(`  ╠══════════════════════════════════════════╣`);
    console.log(`  ║  Serial:   ${CONFIG.SERIAL_NUMBER.padEnd(29)}║`);
    console.log(`  ║  Backend:  ${CONFIG.BACKEND_URL.padEnd(29)}║`);
    console.log(`  ║  Duration: ${(CONFIG.STREAM_DURATION_SECS + 's').padEnd(29)}║`);
    console.log(`  ║  Mode:     ${(LIVE_MODE ? '🔴 LIVE (FFmpeg)' : '🔵 SIMULATION').padEnd(29)}║`);
    console.log(`  ╚══════════════════════════════════════════╝`);

    let streamId = null;
    let icecastUrl = null;
    let mount = null;
    let ffmpegProcess = null;

    // ─── Step 1: Validate ───
    LOG.step(1, 'Validate device (serial lookup)');
    try {
        const res = await request('POST', '/device/validate', {
            serial_number: CONFIG.SERIAL_NUMBER,
        });

        if (res.status === 200 && res.body.valid) {
            LOG.ok(`Device validated! Church ID: ${res.body.church_id}`);
            streamId = res.body.stream_id;
            icecastUrl = res.body.icecast_url;
            mount = res.body.mount;
            LOG.info(`Stream ID: ${streamId}`);
            LOG.info(`Icecast URL: ${icecastUrl}`);
            LOG.info(`Mount: ${mount}`);
        } else {
            LOG.fail(`Validation failed: ${JSON.stringify(res.body)}`);
            LOG.info(`Make sure a machine with machine_id="${CONFIG.SERIAL_NUMBER}" exists, is activated, and is linked to a church with streaming credentials.`);
            process.exit(1);
        }
    } catch (err) {
        LOG.fail(`Cannot reach backend: ${err.message}`);
        LOG.info(`Is the backend running at ${CONFIG.BACKEND_URL}?`);
        process.exit(1);
    }

    // ─── Step 2: Stream Started ───
    LOG.step(2, 'Notify stream started (create session)');
    let sessionId = null;
    try {
        const res = await request('POST', '/device/stream/started', {
            serial_number: CONFIG.SERIAL_NUMBER,
        });

        if (res.status === 200 && res.body.success) {
            sessionId = res.body.session_id;
            LOG.ok(`Session created! ID: ${sessionId}, Church ID: ${res.body.church_id}`);
            if (res.body.message === 'Stream already active') {
                LOG.info('(Idempotent: stream was already active)');
            }
        } else {
            LOG.fail(`Stream start failed: ${JSON.stringify(res.body)}`);
            process.exit(1);
        }
    } catch (err) {
        LOG.fail(`Backend error: ${err.message}`);
        process.exit(1);
    }

    // ─── Step 3: (Optional) Start FFmpeg ───
    LOG.step(3, LIVE_MODE ? 'Starting FFmpeg audio stream' : 'Audio stream (skipped — simulation mode)');

    if (LIVE_MODE && icecastUrl && mount) {
        const fullUrl = `icecast://source:${CONFIG.ICECAST_SOURCE_PASSWORD}@${new URL(icecastUrl).host}${mount}`;
        LOG.info(`FFmpeg target: ${fullUrl}`);

        const ffmpegArgs = [
            '-re',
            '-f', 'lavfi',
            '-i', 'sine=frequency=440:duration=' + (CONFIG.STREAM_DURATION_SECS + 5),
            '-c:a', 'libmp3lame',
            '-b:a', '128k',
            '-content_type', 'audio/mpeg',
            '-f', 'mp3',
            fullUrl,
        ];

        try {
            ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
            ffmpegProcess.on('error', (err) => {
                LOG.fail(`FFmpeg failed: ${err.message}. Is FFmpeg installed?`);
            });
            ffmpegProcess.on('close', (code) => {
                if (code !== 0 && code !== 255) {
                    LOG.info(`FFmpeg exited with code ${code}`);
                }
            });
            LOG.ok('FFmpeg started — 440Hz test tone → Icecast');
        } catch (e) {
            LOG.fail(`Cannot start FFmpeg: ${e.message}`);
        }
    } else if (!LIVE_MODE) {
        LOG.info('Run with --live to enable real audio streaming');
    }

    // ─── Step 4: Wait (stream duration) ───
    LOG.step(4, `Streaming for ${CONFIG.STREAM_DURATION_SECS}s...`);
    LOG.info('👀 Check the PWAs now:');
    LOG.info(`   Priest PWA → http://localhost:3001 (should show LIVE)`);
    LOG.info(`   User PWA   → http://localhost:3002 (should show live church)`);
    if (LIVE_MODE) {
        LOG.info(`   Listen URL → ${icecastUrl}${mount}`);
    }
    console.log('');

    // Countdown
    for (let i = CONFIG.STREAM_DURATION_SECS; i > 0; i--) {
        const bar = '█'.repeat(Math.ceil((CONFIG.STREAM_DURATION_SECS - i) / CONFIG.STREAM_DURATION_SECS * 20));
        const empty = '░'.repeat(20 - bar.length);
        process.stdout.write(`\r       ⏱️  ${bar}${empty} ${formatTime(i)} remaining `);
        await sleep(1000);
    }
    process.stdout.write(`\r       ⏱️  ${'█'.repeat(20)} Done!                    \n`);

    // ─── Step 5: Stream Stopped ───
    LOG.step(5, 'Notify stream stopped (close session)');

    // Kill FFmpeg first
    if (ffmpegProcess) {
        ffmpegProcess.kill('SIGINT');
        ffmpegProcess = null;
        LOG.info('FFmpeg stopped');
    }

    try {
        const res = await request('POST', '/device/stream/stopped', {
            serial_number: CONFIG.SERIAL_NUMBER,
        });

        if (res.status === 200 && res.body.success) {
            LOG.ok(`Session closed! Church ID: ${res.body.church_id}`);
        } else {
            LOG.fail(`Stream stop failed: ${JSON.stringify(res.body)}`);
        }
    } catch (err) {
        LOG.fail(`Backend error: ${err.message}`);
    }

    // ─── Summary ───
    console.log(`\n  ╔══════════════════════════════════════════╗`);
    console.log(`  ║   ✅ E2E Test Complete                    ║`);
    console.log(`  ╠══════════════════════════════════════════╣`);
    console.log(`  ║  Session ID:  ${String(sessionId || 'N/A').padEnd(27)}║`);
    console.log(`  ║  Duration:    ${(CONFIG.STREAM_DURATION_SECS + 's').padEnd(27)}║`);
    console.log(`  ║  Audio:       ${(LIVE_MODE ? 'Real (FFmpeg)' : 'None (simulation)').padEnd(27)}║`);
    console.log(`  ╚══════════════════════════════════════════╝`);
    console.log(`\n  Verify in the PWAs:`);
    console.log(`  • Priest PWA → should now show STBY (stream ended)`);
    console.log(`  • Admin PWA  → new session should appear in Sessions list`);
    console.log(`  • User PWA   → church should no longer be LIVE\n`);

    process.exit(0);
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
    console.log('\n\n  ⚠️  Interrupted! Sending stream/stopped to clean up...');
    try {
        await request('POST', '/device/stream/stopped', {
            serial_number: CONFIG.SERIAL_NUMBER,
        });
        console.log('  ✅ Session cleaned up.\n');
    } catch {
        console.log('  ⚠️  Could not reach backend to clean up.\n');
    }
    process.exit(0);
});

run().catch((err) => {
    console.error(`\n  ❌ Unexpected error: ${err.message}\n`);
    process.exit(1);
});
