"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastLiveState = exports.emitConfigUpdated = exports.initConfigEvents = void 0;
const liveState_1 = require("./liveState");
let ioInstance = null;
function initConfigEvents(io) {
    ioInstance = io;
}
exports.initConfigEvents = initConfigEvents;
function emitConfigUpdated(type, championship) {
    if (!ioInstance)
        return;
    ioInstance.emit('config:updated', { type, championship: championship ?? null });
}
exports.emitConfigUpdated = emitConfigUpdated;
// Usado por sítios fora do socket/index.ts (ex: rotas HTTP como adminAuth)
// que precisam de notificar os clientes de uma mudança no liveState.
function broadcastLiveState() {
    if (!ioInstance)
        return;
    ioInstance.emit('state:sync', liveState_1.liveState);
}
exports.broadcastLiveState = broadcastLiveState;
//# sourceMappingURL=configEvents.js.map