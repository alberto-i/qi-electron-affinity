import { bindMainApi } from "../../src/client_ipc";
import { MainApi2 } from "../api/main_api_2";
import { Catter, recoverer } from "../lib/shared_util";
import { testInvoke } from "../lib/renderer_util";

export async function callMainApi2(winTag: string) {
  winTag = winTag + " ";

  const mainApi2 = await bindMainApi<MainApi2>("MainApi2", recoverer);

  await testInvoke(winTag + "send class instance 2 (api2)", () => {
    return mainApi2.sendCatter2(new Catter("this", "that"));
  });
  await testInvoke(winTag + "get class instance 2 (api2)", () => {
    return mainApi2.makeCatter2("this", "that");
  });
  await testInvoke(winTag + "all good 2 (api2)", () => {
    return mainApi2.allGoodOrNot2(true);
  });
  await testInvoke(winTag + "plain error 2 (api2)", () => {
    return mainApi2.allGoodOrNot2(false);
  });
  await testInvoke(winTag + "same method (api2)", () => {
    return mainApi2.sameMethodUniqueReply();
  });
}
