import { ElectronMainApi } from "../../src/main";

import { MainApi } from "./mainapi";
import { ResultCollector } from "../lib/main_util";

export class MainApi5 extends MainApi implements ElectronMainApi<MainApi5> {
  private _callbacks: ((arg1: string, arg2: number) => void)[]

  constructor(collector: ResultCollector) {
    super(collector)
    this._callbacks = []
  }

  async onFunctionCall(callback: ((arg1: string, arg2: number) => void)) {
    this._setRequestData(callback);
    this._callbacks.push(callback)

    this._onEvent('Event 1 Happened', 1)
  }

  _onEvent(arg1: string, arg2: number) {
    for (const callback of this._callbacks) {
      callback(arg1, arg2)
    }
  }
}
