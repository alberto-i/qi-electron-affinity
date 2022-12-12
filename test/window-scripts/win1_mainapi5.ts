import { reportErrorsToMain, windowFinished } from "../lib/renderer_util";
import { callMainApi5 } from "../api/call_mainapi5";

(async () => {
  try {
    reportErrorsToMain("win1");
    await callMainApi5("win1");
    windowFinished();
  } catch (err) {
    window._affinity_ipc.send("test_aborted", err);
  }
})();
