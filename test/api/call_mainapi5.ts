import { bindMainApi } from "../../src/window";
import type { MainApi5 } from "../api/mainapi5";
import { testInvoke } from "../lib/renderer_util";

export async function callMainApi5(winTag: string) {
  winTag = winTag + " ";

  const mainApi5 = await bindMainApi<MainApi5>("MainApi5"); // no restorer

  await testInvoke(winTag + "callback function (api5)", () => {
    return mainApi5.onFunctionCall((arg1: string, arg2: number) => {
      window._affinity_ipc.send("callback_data", [arg1, arg2]);
    });
  });
}
