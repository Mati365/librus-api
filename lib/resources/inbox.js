"use strict";

const Resource = require("../tools.js").Resource,
  Librus = require("../api.js");

/**
 * Inbox tab class
 * @type {Inbox}
 */
module.exports = class Inbox extends Resource {
  /**
   * Get operation message
   * https://synergia.librus.pl/wiadomosci
   *
   * @param $ Page body
   * @returns {Promise}
   * @private
   */
  static _getConfirmMessage($) {
    let message = $(".green.container").trim();
    if (!message.length) return Promise.reject();
    else return message;
  }

  /**
   * Read message
   * https://synergia.librus.pl/wiadomosci/1
   *
   * @param folderId    Folder ID
   * @param messageId   Message ID
   * @returns {Promise}
   */
  getMessage(folderId, messageId) {
    const url = `wiadomosci/1/${folderId}/${messageId}`;
    return this.api._singleMapper(
      url,
      "table.stretch.container-message td.message-folders+td",
      ($, row) => {
        let table = $(row).find("table:nth-child(2)"),
          header = Librus.mapTableValues(
            $(table),
            ($(table).find("b").first().trim() != "Nadawca"
              ? []
              : ["user"]
            ).concat(["title", "date"])
          );
        let attachment_names = $(row)
          .find("img[src*=filetype]")
          .map((idx, elem) => {
            return $(elem).parent().text().trim();
          });
        let attachment_paths = $(row)
          .find("img[src*=download]")
          .map((idx, elem) => {
            return $(elem)
              .attr("onclick")
              .match(/[^"]+wiadomosci[^"]+/)[0]
              .replace(/\\/g, "")
              .replace(/^\//, "");
          });
        let attachments = attachment_names
          .map((idx, elem) => {
            return {
              name: elem,
              path: attachment_paths[idx],
            };
          })
          .get();
        return {
          title: header.title,
          url,
          id: messageId,
          folderId: folderId,
          date: header.date,
          user: header.user || "",
          content: $(row).find(".container-message-content").trim(),
          html: $(row).find(".container-message-content").html(),
          read: $(row).find("td.left").last().trim() !== "NIE",
          files: attachments,
        };
      }
    );
  }

  getFile(path) {
    return this.api._getFile(path);
  }

  /**
   * Remove message from inbox
   * https://synergia.librus.pl/wiadomosci
   *
   * @param messageId Message ID
   * @returns {Promise}
   */
  removeMessage(messageId) {
    return this.api.caller
      .post("wiadomosci", {
        form: {
          tak: "Tak",
          id: 1,
          Wid: messageId,
          poprzednia: 6,
        },
      })
      .then(Inbox._getConfirmMessage);
  }

  /**
   * Send message to user
   * https://synergia.librus.pl/wiadomosci/2/5
   *
   * @param userId    User ID
   * @param title     Message title
   * @param content   Message content
   * @returns {Promise}
   */
  sendMessage(userId, title, content) {
    /** Fetch cookies */
    let sendPromise = () => {
      /** Send message */
      return this.api.caller
        .post("wiadomosci/5", {
          form: {
            DoKogo: userId,
            temat: title,
            tresc: content,
            poprzednia: 6,
            wyslij: "Wy%C5%9Blij",
          },
        })
        .then(Inbox._getConfirmMessage);
    };
    return this.api.caller.get("wiadomosci/2/5", null, true).then(sendPromise);
  }

  /**
   * Get recipient list from group
   * https://synergia.librus.pl/wiadomosci/2/5
   *
   * @returns {Promise}
   */
  listReceivers(group) {
    return this.api._mapper(
      "wiadomosci/2/5",
      "td.message-recipients table.message-recipients-detail tr[class*='line']",
      ($, row) => {
        return {
          id: parseInt($(row).find("input[name='DoKogo[]']").val()),
          user: $(row).find("label").trim(),
        };
      },
      "post",
      {
        form: { adresat: group },
      }
    );
  }

  /**
   * List inbox all messages headers
   * https://synergia.librus.pl/wiadomosci
   *
   * @param folderId  Folder number
   * @returns {Promise}
   */
  listInbox(folderId) {
    /** Parser */
    const parser = ($, row) => {
      /** get data from table */
      const children = $(row).children("td");
      return {
        id: parseInt($(children[3]).find("a").attr("href").split(/[/]/)[4]),
        user: $(children[2]).trim(),
        title: $(children[3]).trim(),
        date: $(children[4]).trim(),
        read: $(children[2]).attr("style") != "font-weight: bold;",
      };
    };

    /** API call */
    return this.api._mapper(
      `wiadomosci/${folderId}`,
      "table.container-message table.decorated.stretch tbody tr",
      parser,
      "get"
    );
  }

  /**
   * List all announcements
   * https://synergia.librus.pl/ogloszenia
   *
   * @returns {Promise}
   */
  listAnnouncements() {
    return this.api._mapper(
      "ogloszenia",
      "div#body div.container-background table.decorated",
      ($, row) => {
        let cols = $(row).find("td");
        return {
          title: $(row).find("thead").trim(),
          user: $(cols[1]).trim(),
          date: $(cols[2]).trim(),
          content: $(cols[3]).trim(),
        };
      }
    );
  }
};
