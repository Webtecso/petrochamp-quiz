"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopPublicTunnel = exports.startPublicTunnel = void 0;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const liveState_1 = require("../socket/liveState");
const LOCAL_TARGET = 'http://localhost:4000';
const URL_REGEX = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;
const STARTUP_TIMEOUT_MS = 30000;
const RESTART_DELAY_MS = 5000;
const MAX_AUTO_RESTARTS = 5;
let tunnelProcess = null;
let broadcastFn = null;
let startupTimeoutHandle = null;
let restartCount = 0;
let manuallyStopped = false;
let outputBuffer = '';
function setStatus(status) {
    liveState_1.liveState.publicVotingStatus = status;
    broadcastFn?.();
}
function resolveCloudflaredPath() {
    const resourcesPath = process.resourcesPath;
    if (resourcesPath) {
        const bundled = path_1.default.join(resourcesPath, 'cloudflared', 'cloudflared.exe');
        if (fs_1.default.existsSync(bundled))
            return bundled;
    }
    return 'cloudflared';
}
function stripAnsi(text) {
    return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}
function clearStartupTimeout() {
    if (startupTimeoutHandle) {
        clearTimeout(startupTimeoutHandle);
        startupTimeoutHandle = null;
    }
}
function handleOutput(chunk) {
    if (liveState_1.liveState.publicVotingUrl)
        return;
    outputBuffer += stripAnsi(chunk.toString());
    if (outputBuffer.length > 5000) {
        outputBuffer = outputBuffer.slice(-2000);
    }
    const match = outputBuffer.match(URL_REGEX);
    if (match) {
        clearStartupTimeout();
        liveState_1.liveState.publicVotingUrl = `${match[0]}/portal/votacao.html`;
        restartCount = 0;
        setStatus('online');
        console.log(`[tunnel] Portal de votação disponível em: ${liveState_1.liveState.publicVotingUrl}`);
    }
}
function launch() {
    const cloudflaredPath = resolveCloudflaredPath();
    console.log('[tunnel] A iniciar túnel Cloudflare com:', cloudflaredPath);
    setStatus('starting');
    outputBuffer = '';
    liveState_1.liveState.publicVotingUrl = null;
    try {
        tunnelProcess = (0, child_process_1.spawn)(cloudflaredPath, ['tunnel', '--url', LOCAL_TARGET]);
    }
    catch (err) {
        console.error('[tunnel] Falha ao lançar cloudflared:', err);
        setStatus('failed');
        return;
    }
    startupTimeoutHandle = setTimeout(() => {
        if (!liveState_1.liveState.publicVotingUrl) {
            console.error('[tunnel] Túnel não respondeu dentro do tempo limite.');
            setStatus('failed');
        }
    }, STARTUP_TIMEOUT_MS);
    tunnelProcess.stdout.on('data', handleOutput);
    tunnelProcess.stderr.on('data', handleOutput);
    tunnelProcess.on('error', (err) => {
        console.error('[tunnel] Falha ao iniciar cloudflared:', err.message);
        setStatus('failed');
    });
    tunnelProcess.on('exit', (code) => {
        console.log(`[tunnel] Processo cloudflared terminou (código ${code})`);
        clearStartupTimeout();
        tunnelProcess = null;
        liveState_1.liveState.publicVotingUrl = null;
        if (manuallyStopped) {
            setStatus('idle');
            return;
        }
        if (restartCount >= MAX_AUTO_RESTARTS) {
            console.error('[tunnel] Número máximo de tentativas de reinício atingido - a desistir.');
            setStatus('failed');
            return;
        }
        restartCount += 1;
        console.log(`[tunnel] A tentar reiniciar o túnel em ${RESTART_DELAY_MS / 1000}s (tentativa ${restartCount}/${MAX_AUTO_RESTARTS})...`);
        setStatus('starting');
        setTimeout(() => {
            if (!manuallyStopped)
                launch();
        }, RESTART_DELAY_MS);
    });
}
function startPublicTunnel(broadcast) {
    if (tunnelProcess)
        return;
    manuallyStopped = false;
    restartCount = 0;
    broadcastFn = broadcast;
    launch();
}
exports.startPublicTunnel = startPublicTunnel;
function stopPublicTunnel() {
    manuallyStopped = true;
    clearStartupTimeout();
    if (tunnelProcess) {
        tunnelProcess.kill();
        tunnelProcess = null;
    }
    setStatus('idle');
}
exports.stopPublicTunnel = stopPublicTunnel;
//# sourceMappingURL=tunnel.js.map