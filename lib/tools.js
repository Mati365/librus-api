"use strict";

const cheerio = require("cheerio");

/**
 * Make boolean from title
 * @param status  Librus status
 * @returns {boolean}
 */
function makeBoolean(status) {
  return status.toLowerCase() === "tak";
}

/**
 * API resource
 * @type {Resource}
 */
class Resource {
  constructor(api) {
    this.api = api;
  }
}

/** Export */
module.exports = {
  Resource: Resource,
  makeBoolean: makeBoolean,
};
