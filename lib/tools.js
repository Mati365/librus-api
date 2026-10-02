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
 * Same as text().trim() but preserves newlines
 * @param elem  Element
 * @returns {string}
 */
function textWithLF(elem) {
  if (!elem) return;
  let $ = cheerio.load(elem);
  let html = $.html().replace(/<br\s*[\/]?>/gi, "\n");
  return $("<div>").html(html).text().trim();
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
  textWithLF: textWithLF,
};
