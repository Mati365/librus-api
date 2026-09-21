"use strict";

import { LibrusClient } from "./dist/index.js";

const client = new LibrusClient(
  process.env.LIBRUS_LOGIN,
  process.env.LIBRUS_PASSWORD
);

console.log("info.getAccountInfo()");
console.log(await client.info.getAccountInfo());
console.log("info.getLuckyNumber()");
console.log(await client.info.getLuckyNumber());
