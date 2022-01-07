"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
exports.__esModule = true;
exports.setIpcBindingTimeout = exports.bindMainApi = exports.exposeMainApi = void 0;
var server_ipc_1 = require("./server_ipc");
__createBinding(exports, server_ipc_1, "exposeMainApi");
var client_ipc_1 = require("./client_ipc");
__createBinding(exports, client_ipc_1, "bindMainApi");
var shared_ipc_1 = require("./shared_ipc");
__createBinding(exports, shared_ipc_1, "setIpcBindingTimeout");
//# sourceMappingURL=index.js.map