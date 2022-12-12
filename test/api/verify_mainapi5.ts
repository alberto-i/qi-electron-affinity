import * as assert from "assert";

import { ResultCollector } from "../lib/main_util";

const test = it;

export default (winTag: string, collector: ResultCollector) => {
  winTag = winTag + " ";

  test(
    winTag + "register callback and get a call (api5)",
    async () => {
      collector.verifyTest(
        winTag + "callback function (api5)",
        (result) => {
          assert.equal(result.error, null);
          assert.deepEqual(result.callbackData, ['Event 1 Happened', 1]);
        }
      );
    }
  );
};
