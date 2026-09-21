import { accountInfoSchema, luckyNumberSchema } from "../schemas/info.js";
import type { AccountInfo, LuckyNumber } from "../types/info.js";
import { Resource } from "./resource.js";

export class InfoResource extends Resource {
  /** Current student / account snapshot. */
  getAccountInfo(): Promise<AccountInfo> {
    return this.get("/Me", accountInfoSchema);
  }

  /** Today's lucky number for the school. */
  getLuckyNumber(): Promise<LuckyNumber> {
    return this.get("/LuckyNumbers", luckyNumberSchema);
  }
}
