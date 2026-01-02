import { getReferrerUrl, logBlocked, bindActions } from "./blocked-common.js";

(async ()=>{
  await logBlocked(getReferrerUrl(), "domain");
  bindActions();
})();
