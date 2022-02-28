"use strict";
/**
 * Code used by both main and renderer processes.
 */
exports.__esModule = true;
exports.retryUntilTimeout = exports.toIpcName = exports.getPropertyNames = exports.exposeApi = exports.setIpcBindingTimeout = exports.API_RESPONSE_IPC = exports.API_REQUEST_IPC = void 0;
// Name of IPC requesting an API for binding.
exports.API_REQUEST_IPC = "_affinity_api_request";
// Name of IPC providing information needed to bind to an API.
exports.API_RESPONSE_IPC = "_affinity_api_response";
// Period between attempts to bind an API.
var _RETRY_MILLIS = 50;
// Configurable timeout attempting to bind an API.
var _bindingTimeoutMillis = 4000;
/**
 * Sets the binding timeout. This is the maximum time allowed for the main
 * process to bind to any window API and the maximum time allowed for a
 * window to bind to a main API. Also applies to any bindings in progress.
 *
 * @param millis Duration of timeout in milliseconds
 */
function setIpcBindingTimeout(millis) {
    _bindingTimeoutMillis = millis;
}
exports.setIpcBindingTimeout = setIpcBindingTimeout;
// Makes an API available for remote binding, installing method handlers.
function exposeApi(apiMap, api, installHandler) {
    var apiClassName = api.constructor.name;
    if (apiMap[apiClassName]) {
        return; // was previously exposed
    }
    var methodNames = [];
    for (var _i = 0, _a = getPropertyNames(api); _i < _a.length; _i++) {
        var methodName = _a[_i];
        if (methodName != "constructor" && !["_", "#"].includes(methodName[0])) {
            var method = api[methodName];
            if (typeof method == "function") {
                installHandler(toIpcName(apiClassName, methodName), method);
                methodNames.push(methodName);
            }
        }
    }
    apiMap[apiClassName] = methodNames;
}
exports.exposeApi = exposeApi;
// Returns all properties of the class not defined by JavaScript.
function getPropertyNames(obj) {
    var propertyNames = [];
    while (!Object.getOwnPropertyNames(obj).includes("hasOwnProperty")) {
        propertyNames.push.apply(propertyNames, Object.getOwnPropertyNames(obj));
        obj = Object.getPrototypeOf(obj);
    }
    return propertyNames;
}
exports.getPropertyNames = getPropertyNames;
// Constructs an API-specific IPC name for a method.
function toIpcName(apiClassName, methodName) {
    return "".concat(apiClassName, ":").concat(methodName);
}
exports.toIpcName = toIpcName;
// Utility for retrying a function until success or timeout.
function retryUntilTimeout(elapsedMillis, attemptFunc, timeoutMessage) {
    if (!attemptFunc()) {
        if (elapsedMillis >= _bindingTimeoutMillis) {
            throw Error(timeoutMessage);
        }
        setTimeout(function () {
            return retryUntilTimeout(elapsedMillis + _RETRY_MILLIS, attemptFunc, timeoutMessage);
        }, _RETRY_MILLIS);
    }
}
exports.retryUntilTimeout = retryUntilTimeout;
//# sourceMappingURL=shared_ipc.js.map