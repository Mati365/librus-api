"use strict";
const _ = require("lodash");
const Resource = require("../tools.js").Resource
    , Librus = require("../api");

module.exports = class Calendar extends Resource {
  /**
   * Get event description
   * https://synergia.librus.pl/terminarz/szczegoly
   *
   * @param id  Event ID
   * @param isAbsence Make it 'true' if the event is teacher's absence
   * @returns {Promise}
   */
  getEvent(id, isAbsence = false) {
    if (isAbsence) {
      return this.api
        ._tableMapper(
            `terminarz/szczegoly_wolne/${id}`
          , "table.decorated.small.center tbody"
          , [ "teacher"
            , "range"
            , "added"
          ]
        );
    }
    else {
      return this.api
        ._tableMapper(
            `terminarz/szczegoly/${id}`
          , "table.decorated.medium.center tbody"
          , [ "date"
            , "lessonIndex"
            , "teacher"
            , "type"
            , "lesson"
            , "description"
            , "added"
          ]
        );
    }
  }

  /**
   * Get all calendar data
   * https://synergia.librus.pl/terminarz
   *
   * @returns {Promise}
   * @param month Choose calendar month (1-12)
   */
  getCalendar(month) {
    const currentDate = new Date();

    let parser = ($, column) => {
      let table = $(column).next("table");
      if(!table)
        return [];

      return _.map($(table).find("td"), child => {
        let onclick = $(child).attr("onclick");
        return {
            id: parseInt(onclick && onclick.match(/\/(\d*)'$/)[1]) || -1
          , day: `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${$(column).text()}`
          , title: $(child).trim()
        };
      });
    };
    return this.api
      ._mapper(
          "terminarz"
        , "table.kalendarz.decorated.center tbody td .kalendarz-numer-dnia"
        , parser
        , "post"
        , {
          form: {
            'miesiac': month
          }
        }
      );
  }

  /**
   * Get school timetable
   * https://synergia.librus.pl/przegladaj_plan_lekcji
   *
   * @param from  From date e.g. 2015-12-14
   * @param to    To date e.g. 2015-12-21
   * @returns {Promise}
   */
  getTimetable(from, to) {
    const days = [
        "Monday", "Tuesday", "Wednesday"
      , "Thursday", "Friday", "Saturday"
      , "Sunday"
    ];

    /** Parser */
    let parser = ($, row) => {
      let list = _.map($(row).children("td:not(:first-child):not(:last-child)"), cell => {
        let title = $(cell).find(".text").trim() || $(cell).trim();
        if(!title)
          return null;
        else 
          return {
            title: title
            , flag: $(cell).find(".center.plan-lekcji-info.tooltip").trim() || $(cell).find(".center.plan-lekcji-info").trim()
          }
      });
      return {
          hour: $(row).find("th").trim()
        , list: list
      }
    };

    /**
     * Map columns in first array to others
     * @param $   Document
     * @returns {Array}
     * @example
     *
     * ['a', 'b', 'c']
     * [1, 2, 3]
     * [4, 5, 6]
     *
     * daysMapper([[1,2,3],[4,5,6]])
     * // => ['a': [1, 4], 'b':[2,5], 'c': [3,6]]
     */
    let tableMapper = $ => {
      /** Map rows to days */
      let table = {}
        , rows = Librus.arrayMapper($, parser, "table.decorated.plan-lekcji tr:nth-child(even)");
      _.each(rows, value => {
          for(let i = 0;i < value.list.length;++i) {
            let key = days[i];
            (table[key] = table[key] || []).push(value.list[i]);
          }
        });
        
      return {
          hours: _.map(rows, "hour")
        , table: table
      };
    };


    /** API call */
    return this.api.caller
      .post(
          "przegladaj_plan_lekcji"
        , {
          form: { 'tydzien': from && `${from}_${to}` }
        }
      )
      .then(tableMapper);
  }
};
