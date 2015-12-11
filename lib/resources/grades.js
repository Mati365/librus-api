"use strict";
const _ = require("lodash");
const Resource = require("../tools.js").Resource;

module.exports = class Grades extends Resource {
  getGrades() {
    return this.api._mapper(
        "przegladaj_oceny/uczen"
      , "table.decorated.stretch tr[class*='line']:nth-child(even)"
      , ($, row) => {
        console.log($(row).children("td").eq(1).trim());
      });
  }
};