"use strict";
const _ = require("lodash");
const Resource = require("../tools.js").Resource;

module.exports = class Grades extends Resource {
  /**
   * Get grades list
   * https://synergia.librus.pl/przegladaj_oceny/uczen
   *
   * @returns {Promise}
   */
  getGrades() {
    let parser = ($, row) => {
      let children = $(row).children("td");

      /**
       * Get average from column text
       * @param colIndex  Column index
       * @returns {Number}
       */
      let parseAverage = colIndex => {
        return parseFloat($(children[colIndex]).text());
      };

      /**
       * Parse semester, get average and grades
       * @param startColumn
       */
      let parseSemester = (startColumn) => {
        let grades =_.map($(children[startColumn]).children("span.grade-box"), element => {
          return {
              id: parseInt($(element).find("a").attr("href").match(/szczegoly\/(\d*)$/)[1])
            , value: $(element).trim()
            , color: $(element).css("background-color").slice(1)
          };
        });
        return {
            grades: grades
          , tempAverage: parseAverage(startColumn + 1)
          , average: parseAverage(startColumn + 2)
        };
      };
      return {
          name: $(children[1]).trim()
        , semester: [parseSemester(2), parseSemester(5)]
        , tempAverage: parseAverage(8)
        , average: parseAverage(9)
      }
    };
    return this.api._mapper(
        "przegladaj_oceny/uczen"
      , "table.decorated.stretch > tr[class^='line']:not([name])"
      , parser
    );
  }
};