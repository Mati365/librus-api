"use strict";
const _ = require("lodash");

const Resource = require("../tools.js").Resource;

module.exports = class Homework extends Resource {
  /**
   * List all subjects in combobox
   * https://synergia.librus.pl/moje_zadania
   *
   * @returns {Promise}
   */
  listSubjects() {
    return this.api._mapper(
      "moje_zadania",
      "form#formFiltrZadania select#przedmiot option",
      ($, option) => {
        return {
          id: parseInt($(option).val()),
          name: $(option).trim(),
        };
      }
    );
  }

  /**
   * List homework
   * https://synergia.librus.pl/moje_zadania
   *
   * @param subjectId   Subject id
   * @param from        From date
   * @param to          To date
   * @returns {Promise}
   */
  listHomework(subjectId, from, to) {
    let formData = new FormData()
    formData.append("dataOd", from)
    formData.append("dataDo", to)
    formData.append("przedmiot", subjectId)
    formData.append("submitFiltr",  "Filtruj")
    return this.api._mapper(
      "moje_zadania",
      "table.decorated.myHomeworkTable tbody tr",
      ($, row) => {
        let children = $(row).children("td"),
          id = $(children[9])
            .children("input")
            .attr("onclick")
            .match(/\/podglad\/(\d*)/)[1];
        return {
          id: parseInt(id),
          subject: $(children[0]).trim(),
          user: $(children[1]).trim(),
          title: $(children[2]).trim(),
          type: $(children[3]).trim(),
          from: $(children[4]).trim(),
          to: $(children[6]).trim(),
          status: $(children[8]).trim(),
        };
      },
      "post",
      formData
    );
  }

  /**
   * Get homework description
   * https://synergia.librus.pl/moje_zadania/podglad/
   *
   * @param id   Homework id
   * @returns {Promise}
   */
  getHomework(id) {
    return this.api._tableMapper(
      `moje_zadania/podglad/${id}`,
      "table.decorated tbody",
      ["user", "title", "type", "from", "to", "content"]
    );
  }
};
