/**
 * Code specific to handling IPC in the renderer process.
 */

import type { ElectronMainApi } from "./main_lib";
import {
  API_REQUEST_IPC,
  API_RESPONSE_IPC,
  ApiRegistration,
  ApiRegistrationMap,
  PublicProperty,
  retryUntilTimeout,
  toIpcName,
  exposeApi,
} from "./shared_lib";
import { Restorer, RestorerFunction } from "./restorer_lib";

//// MAIN API SUPPORT //////////////////////////////////////////////////////

/**
 * Type to which a bound main API conforms within a window, as determined by
 * the provided main API class. The type only exposes the API methods of the
 * class, exposing the methods with the exact return types given by their
 * implementations, which are necessarily promises.
 *
 * @param <T> Type of the main API class
 */
export type MainApiBinding<T> = { [K in PublicProperty<keyof T>]: T[K] };

// These window._affinity_ipc methods are defined in preload.ts
declare global {
  interface Window {
    _affinity_ipc: {
      invoke: (channel: string, data?: any) => Promise<any>;
      send: (channel: string, data: any) => void;
      on: (channel: string, func: (data: any) => void) => void;
      onCallback: (callbackName: string, func: Function) => void;
    };
  }
}

// Structure mapping API names to the methods they contain.
const _mainApiMap: ApiRegistrationMap = {};

// Structure tracking bound main APIs.
const _boundMainApis: Record<string, MainApiBinding<any>> = {};

/**
 * Returns a window-side binding for a main API of a given class. Main must
 * have previously exposed the API. Failure of the main process to expose the
 * API before timeout results in an exception. There is a default timeout, but
 * you can override it with `setIpcBindingTimeout()`.
 *
 * @param <T> Type of the main API class to bind
 * @param apiClassName Name of the class being bound. Must be identical to
 *    the name of class T. Provides runtime information that <T> does not.
 * @param restorer Optional function for restoring the classes of API return
 *    values. Return values not restored arrive as untyped objects.
 * @returns An API of type T that can be called as if T were local to
 *    the window.
 * @see setIpcBindingTimeout
 */
export function bindMainApi<T extends ElectronMainApi<T>>(
  apiClassName: string,
  restorer?: RestorerFunction
): Promise<MainApiBinding<T>> {
  _installIpcListeners();

  return new Promise((resolve) => {
    if (_boundMainApis[apiClassName]) {
      resolve(_boundMainApis[apiClassName]);
    } else {
      // Make only one request, as main must prevously expose the API.
      window._affinity_ipc.send(API_REQUEST_IPC, apiClassName);
      // Client retries so it can bind at earliest possible time.
      retryUntilTimeout(
        0,
        () => {
          return _attemptBindMainApi(apiClassName, restorer, resolve);
        },
        `Timed out waiting to bind main API '${apiClassName}'`
      );
    }
  });
}

// Implements a single attempt to bind to a main API.
function _attemptBindMainApi<T>(
  apiClassName: string,
  restorer: RestorerFunction | undefined,
  resolve: (boundApi: MainApiBinding<T>) => void
): boolean {
  // Wait for the window API binding to arrive.

  const methodNames = _mainApiMap[apiClassName] as [keyof MainApiBinding<T>];
  if (!methodNames) {
    return false;
  }

  // Construct the main API binding.

  const boundApi = {} as MainApiBinding<T>;
  for (const methodName of methodNames) {
    boundApi[methodName] = (async (...args: any[]) => {
      const callbacks = Restorer.makeArgsRestorable(args);
      for (const [eventName, callback] of Object.entries(callbacks)) {
        window._affinity_ipc.onCallback(eventName, callback);
      }
      const response = await window._affinity_ipc.invoke(
        toIpcName(apiClassName, methodName as string),
        args
      );
      const returnValue = response[0];
      const info = response[1];
      if (Restorer.wasThrownValue(returnValue)) {
        throw Restorer.restoreThrownValue(returnValue, info, restorer);
      }
      return Restorer.restoreValue(returnValue, info, restorer);
    }) as any; // 'any' makes it compatible with the method's signature
  }

  // Save the binding to return on duplicate binding requests.

  _boundMainApis[apiClassName] = boundApi;

  // Return the binding to the window.

  resolve(boundApi);
  return true;
}

//// WINDOW API SUPPORT //////////////////////////////////////////////////////

// Structure mapping window API names to the methods each contains.
let _windowApiMap: ApiRegistrationMap = {};

/**
 * Type to which a window API class must conform. All public properties of the
 * method and all properties not beginning with `_` or `#` will be exposed as
 * API methods, allowing the API class to have private properties on which the
 * API methods rely. This type will not expose properties declared `protected`
 * or `private`, but `bindWindowApi()` will still generate bindings for those
 * whose names don't begin with `_` or `#`. Have your window APIs `implement`
 * this type to get type-checking in the APIs themselves, passing in the API
 * class itself for T. Use `checkWindowApi` or  `checkWindowApiClass` to
 * type-check variables containing window APIs.
 *
 * @param <T> The type of the API class itself, typically inferred from a
 *    function that accepts an argument of type `ElectronWindowApi`.
 * @see checkWindowApi
 * @see checkWindowApiClass
 */
export type ElectronWindowApi<T> = {
  [K in PublicProperty<keyof T>]: (...args: any[]) => void;
};

/**
 * Type checks the argument to ensure it conforms to the expectations of an
 * instance of a window API class. Returns the argument to allow type-checking
 * of APIs in their places of use.
 *
 * @param <T> (inferred type, not specified in call)
 * @param api Instance of the window API class to type check
 * @return The provided window API instance
 * @see checkWindowApiClass
 */
export function checkWindowApi<T extends ElectronWindowApi<T>>(api: T): T {
  return api;
}

/**
 * Type checks the argument to ensure it conforms to the expectations of a
 * window API class. Returns the argument to allow type-checking of APIs in
 * their places of use.
 *
 * @param <T> (inferred type, not specified in call)
 * @param _class The window API class to type check
 * @return The provided window API class
 * @see checkWindowApi
 */
export function checkWindowApiClass<T extends ElectronWindowApi<T>>(_class: {
  new (...args: any[]): T;
}): {
  new (...args: any[]): T;
} {
  return _class;
}

/**
 * Exposes a window API to the main process for possible binding.
 *
 * @param <T> (inferred type, not specified in call)
 * @param windowApi The API to expose to the main process, which must be
 *    an instance of a class conforming to type `ElectronWindowApi`. Only
 *    one instance of any given class can ever be exposed.
 * @param restorer Optional function for restoring the classes of
 *    arguments passed to APIs from the main process. Arguments not
 *    restored to original classes arrive as untyped objects.
 */
export function exposeWindowApi<T extends ElectronWindowApi<T>>(
  windowApi: T,
  restorer?: RestorerFunction
): void {
  _installIpcListeners();
  exposeApi(_windowApiMap, windowApi, (ipcName, method) => {
    window._affinity_ipc.on(ipcName, (args: any[]) => {
      Restorer.restoreArgs(args, restorer);
      method.bind(windowApi)(...args);
    });
  });
}

//// COMMON MAIN & WINDOW SUPPORT API ////////////////////////////////////////

let _listeningForIPC = false;

function _installIpcListeners() {
  if (!_listeningForIPC) {
    window._affinity_ipc.on(API_REQUEST_IPC, (apiClassName: string) => {
      const registration: ApiRegistration = {
        className: apiClassName,
        methodNames: _windowApiMap[apiClassName],
      };
      window._affinity_ipc.send(API_RESPONSE_IPC, registration);
    });
    window._affinity_ipc.on(API_RESPONSE_IPC, (api: ApiRegistration) => {
      _mainApiMap[api.className] = api.methodNames;
    });
    _listeningForIPC = true;
  }
}
