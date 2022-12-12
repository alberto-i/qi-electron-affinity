/**
 * Test calling methods of a single main API under normal circumstances.
 */

import { BrowserWindow } from "electron";

import { exposeMainApi, checkMainApi } from "../src/main";
import { createWindow, createResultCollector } from "./lib/main_util";
import { MainApi5 } from "./api/mainapi5";
import { restorer, assertIdentical } from "./lib/shared_util";
import verifyMainApi5 from "./api/verify_mainapi5";

const resultCollector = createResultCollector(restorer);

const mainApi5 = new MainApi5(resultCollector);
assertIdentical(mainApi5, checkMainApi(mainApi5));

describe("window invoking an exposed main API with callback", () => {
  let window1: BrowserWindow;

  before(async () => {
    window1 = await createWindow();
    // includes test of exposing API after running script
    resultCollector.runScripFiletInWindow(window1, "win1_mainapi5");
    exposeMainApi(mainApi5, restorer);
    await resultCollector.waitForResults();
  });

  verifyMainApi5("win1", resultCollector);

  after(() => {
    if (window1) window1.destroy();
    resultCollector.verifyAllDone();
  });
});
