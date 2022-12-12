/**
 * Support for restoring the classes of arguments and return values.
 */

/**
 * Type of a class that can be called to restore class values. It defines
 * the static class method `restoreClass`, which takes the unstructured
 * object received via IPC and returns an instance of class C. Use for
 * creating generic restorer functions, as explained in the documentation.
 *
 * @param <C> The class that conforms to this type.
 */
export type RestorableClass<C> = {
  // static method of the class returning an instance of the class
  restoreClass(obj: Record<string, any>): C;
};

/**
 * Type for a function that restores the classes of arguments and return
 * values. This function is optionally the last parameter passed when
 * exposing a main API, binding to a main API, or exposing a window API.
 * The function need not restore the class of a provided object, in which
 * case it returns the provided object.
 *
 * @param className The name of the class at the time its instance was
 *    transferred via IPC
 * @param obj The unstructured object to which the class instance was
 *    converted for transmission via IPC
 * @return Either the provided object `obj` if it was not converted into
 *    a class instance, or an instance of class `className` sourced from
 *    the data in `obj`
 */
export type RestorerFunction = (
  className: string,
  obj: Record<string, any>
) => any;

// Structure describing how to restore an object IPC argument or return value.
interface RestorationInfo {
  argIndex?: number; // if not return value, index of argument in args list
  className: string; // name of the object's class
  isError: boolean; // whether the object subclasses Error
  isCallback: boolean; // whether the argument is a function
}

/**
 * A generic implementation of a restorer function, which becomes an instance
 * of `RestorerFunction` when bound to a map of restorable classes (each
 * conforming to type `RestorableClass`). See the example in the docs.
 *
 * @param restorableClassMap An object whose properties map the names of
 *    restorable classes to the restorable classes themselves
 * @param className The name of the class at the time its instance was
 *    transferred via IPC
 * @param obj The unstructured object to which the class instance was
 *    converted for transmission via IPC
 * @return An instance of a class in `restorableClassMap` if `className` is in
 *    this map, sourced from the provided `obj`, or the provided `obj` itself
 *    if `className` is not in `restorableClassMap`
 */
export function genericRestorer(
  restorableClassMap: Record<string, RestorableClass<any>>,
  className: string,
  obj: Record<string, any>
): any {
  const restorableClass = restorableClassMap[className];
  return restorableClass === undefined
    ? obj
    : restorableClass["restoreClass"](obj);
}

export namespace Restorer {
  let callbackIx = 0;

  // Makes all the arguments of an argument list restorable.
  export function makeArgsRestorable(args: any[]) {
    const callbacks = {} as {[key: string]: Function}
    const infos: RestorationInfo[] = [];
    if (args !== undefined) {
      for (let i = 0; i < args.length; ++i) {
        const info = Restorer.makeRestorationInfo(args[i]);
        if (info) {
          info.argIndex = i;

          if (info.isCallback) {
            const callbackName = `_affinity_event_callback_${++callbackIx}`
            callbacks[callbackName] = args[i]
            args[i] = callbackName
          }

          infos.push(info);
        }
      }
    }
    // Passed argument list always ends with restoration information.
    args.push(infos);
    return callbacks;
  }

  // Returns information needed to restore an object to its original class.
  export function makeRestorationInfo(obj: any): RestorationInfo | null {
    if (obj === null) {
      return null;
    }
    if (typeof obj != "object" && typeof obj != "function") {
      return null;
    }
    return {
      className: obj.constructor.name,
      isError: obj instanceof Error,
      isCallback: typeof obj == 'function'
    };
  }

  // Makes an error returnable to the caller for restoration and
  // re-throwing, returning the value that the API must return.
  // The thrown value need not be an instance of error.
  export function makeRethrownReturnValue(thrown: any): object {
    // Electron will throw an instance of Error either thrown from
    // here or returned from here, but that instance will only carry
    // the message property and no other properties. In order to
    // retain the error properties, I have to return an object that
    // is not an instance of error. However, I'm intentionally not
    // preserving the stack trace, hiding it from the client.
    if (typeof thrown !== "object") {
      thrown = new __ThrownNonObject(thrown);
      return [thrown, Restorer.makeRestorationInfo(thrown)];
    }
    const info = Restorer.makeRestorationInfo(thrown);
    const returnedError = Object.assign(
      { _affinity_rethrow: true },
      thrown instanceof Error ? { message: thrown.message } : {},
      thrown
    );
    delete returnedError.stack;
    return [returnedError, info];
  }

  // Determines whether a returned value is actually a thrown value.
  export function wasThrownValue(value: any): boolean {
    return value != undefined && value._affinity_rethrow;
  }

  // Restores argument list using provided restorer function.
  export function restoreArgs(args: any[], restorer?: RestorerFunction) {
    const callbacks: { [key: string]: number } = {};

    if (args !== undefined) {
      const infos: RestorationInfo[] = args.pop();
      let infoIndex = 0;
      for (let argIndex = 0; argIndex < args.length; ++argIndex) {
        const info = infoIndex < infos.length && argIndex == infos[infoIndex].argIndex
        ? infos[infoIndex++]
        : undefined

        args[argIndex] = Restorer.restoreValue(
          args[argIndex],
          info,
          restorer
        );

        if (info && info.isCallback) {
          callbacks[args[argIndex] as string] = argIndex
        }
      }
    }

    return callbacks
  }

  // Restores the class of an argument or return value when possible.
  export function restoreValue(
    obj: any,
    info?: RestorationInfo,
    restorer?: RestorerFunction
  ): any {
    if (info) {
      if (info.className == "__ThrownNonObject") {
        obj = new __ThrownNonObject(obj.thrownValue);
      } else if (restorer !== undefined) {
        obj = restorer(info.className, obj);
      }
    }
    return obj;
  }

  // Restores a value that was thrown for re-throwing after being returned.
  export function restoreThrownValue(
    value: any,
    info: RestorationInfo,
    restorer?: RestorerFunction
  ): Error {
    delete value._affinity_rethrow;
    value = restoreValue(value, info, restorer);

    // If a non-object value was thrown
    if (value instanceof __ThrownNonObject) {
      return value.thrownValue;
    }

    // If restorer didn't restore the original Error class
    if (!(value instanceof Error) && info.isError) {
      const message = value.message;
      delete value.message;
      value = Object.assign(new Error(message), value);
    }

    // Replace any newly generated stack.
    if (value instanceof Error) {
      value.stack = `${value.constructor.name}: ${value.message}\n\tin main process`;
    }
    return value;
  }

  // Wraps thrown non-object values for relay to client. Prefixed with
  // underscores to prevent name conflict with application classes.
  export class __ThrownNonObject {
    _affinity_rethrow = true;
    thrownValue: any;

    constructor(thrownValue: any) {
      this.thrownValue = thrownValue;
    }
  }
}
