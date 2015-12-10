"use strict";
const _ = require("lodash");
const Resource = require("../tools.js").Resource;

module.exports = class Calendar extends Resource {
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
      return _.map($(row).children("td:not(:first-child):not(:last-child)"), cell => {
        let title = $(cell).find(".text").trim();
        if(!title)
          return null;
        else
          return {
              title: title
            , flag: $(cell).find(".center.plan-lekcji-info.tooltip").trim()
          }
      });
    };

    /**
     * Map columns in first array to others
     * @param array   Array
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
    let daysMapper = array => {
      /** Map rows to days */
      let table = _.reduce(array, (result, value) => {
        for(let i = 0;i < value.length;++i) {
          let key = days[i];
          (result[key] = result[key] || []).push(value[i]);
        }
        return result;
      });

      /** Return final result */
      return {
        table: table
      };
    };

    /** API call */
    return this.api._mapper(
        "przegladaj_plan_lekcji"
      , "table.decorated.plan-lekcji tr:nth-child(even)"
      , parser
      , "post"
      , {
        form: { 'tydzien': `${from}_${to}` }
      }
    )
      .then(daysMapper);
  }
};