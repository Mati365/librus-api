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
  getAccountInfo(){
    let parser = ($,element) => {
      return {
        student: {
          nameSurname: $('#body > div > div > table > tbody > tr:nth-child(1) > td').text(),
          class: $('#body > div > div > table > tbody > tr:nth-child(2) > td').text().trim(),
          index: $('#body > div > div > table > tbody > tr:nth-child(3) > td').text().trim(),
          educator: $('#body > div > div > table > tbody > tr:nth-child(4) > td').text().trim(),
        },
        account: {
          nameSurname: $('#body > div > div > table > tbody > tr:nth-child(7) > td').text().trim(),
          login: $("#body > div > div > table > tbody > tr:nth-child(8) > td").text().trim()
        }
         
      };
    }
    return this.api._singleMapper('informacja', "html", parser);
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
   * Get Point grade info
   * https://synergia.librus.pl/przegladaj_oceny_punktowe/szczegoly
   *
   * @param gradeId Grade ID
   * @returns {Promise}
   */
  getPointGrade(gradeId) {
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
          `przegladaj_oceny_punktowe/szczegoly/${gradeId}`
        , ".container-background table.decorated.medium.center"
        , parser
      );
  }
   /**
   * Get lucky number
   * https://synergia.librus.pl/uczen/index
   * 
   * @returns {Promise}
   */
  getLuckyNumber(){
	let parser = ($,element) => {
		return parseInt(element.children[1].children[0].data)
	}
	return this.api._singleMapper(
	  'uczen/index'
	, ".luckyNumber"
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
              id: parseInt($(element).find("a").attr("href").split("/")[$(element).find("a").attr("href").split("/").length - 1])
            , value: $(element).trim()
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
      , "table.decorated.stretch > tbody > tr[class^='line']:not([name]),table.decorated.stretch > tr[class^='line']:not([name])"
      , parser
    );
  }
};
