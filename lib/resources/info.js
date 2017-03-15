"use strict";
const _ = require("lodash");
const Resource = require("../tools.js").Resource
    , Librus = require("../api.js");

module.exports = class Info extends Resource {
  /**
   * Get notifications
   * https://synergia.librus.pl/uczen_index
   *
   * @returns {Promise}
   */
  getNotifications() {
    return this.api
      ._mapper(
          "uczen_index"
        , "#graphic-menu ul li"
        , ($, element) => {
          return parseInt($(element).children("a.button.counter").trim()) || 0;
        }
      )
      .then(array => {
        return _.zipObject(
          [ 'grades'
          , 'absence'
          , 'inbox'
          , 'services'
          , 'smsInfo'
          , 'announcements'
          , 'calendar'
          , 'homework'
          ], array);
      });
  }

  /**
   * Get grade info
   * https://synergia.librus.pl/przegladaj_oceny/szczegoly
   *
   * @param gradeId Grade ID
   * @returns {Promise}
   */
  getGrade(gradeId) {
    let parser = ($, table) => {
      let keys = [
          "grade"
        , "category"
        , "date"
        , "teacher"
        , "lesson"
        , "inAverage"
        , "multiplier"
        , "user"
        , "comment"
      ];

      switch($(table).find("th").length) {
        /** e.g. - */
        case 7:
          _.pullAt(keys, 5, 6);
          break;

        /** with multiplier 0 */
        case 8:
          _.pullAt(keys, 6);
          break;
      }

      let values = Librus.mapTableValues(table, keys);
      return "inAverage" in values
        ? _.assign(values, {
          inAverage: $(table).find("img").attr("src") === "/images/aktywne.png"
        })
        : values;
    };
    return this.api
      ._singleMapper(
          `przegladaj_oceny/szczegoly/${gradeId}`
        , ".container-background table.decorated.medium.center tbody"
        , parser
      );
  }

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
      let average = colIndex => {
        return parseFloat($(children[colIndex]).text());
      };

      /**
       * Parse semester, get average and grades
       * @param startColumn
       */
      let semester = (startColumn) => {
        let grades =_.map($(children[startColumn]).children("span.grade-box"), element => {
          const color = $(element).css("background-color");
          return {
              id: parseInt($(element).find("a").attr("href").match(/szczegoly\/(\d*)$/)[1])
            , value: $(element).trim()
            , color: color && color.slice(1)
          };
        });
        return {
            grades: grades
          , tempAverage: average(startColumn + 1)
          , average: average(startColumn + 2)
        };
      };

      const name = $(children[1]).trim();
      if(name)
        return {
            name
          , semester: [
              semester(2), 
			  semester(5),
			  semester(6),
			  semester(9)
          ]
          , tempAverage: average(8)
          , average: average(9)
        };
    };
    return this.api._mapper(
        "przegladaj_oceny/uczen"
      , "table.decorated.stretch > tr[class^='line']:not([name])"
      , parser
    );
  }
};