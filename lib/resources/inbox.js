"use strict";

const Resource = require("../tools.js").Resource
    , Librus = require("../api.js");

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
    if(!message.length)
      return Promise.reject();
    else
      return message;
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
    return this.api._singleMapper(
        `wiadomosci/1/${folderId}/${messageId}`
      , "table.stretch.container-message td.message-folders+td"
      , ($, row) => {
        let table = $(row).find("table:nth-child(2)")
          , header =  Librus.mapTableValues(
              table
            , ($(table).find("b").first().trim() != "Nadawca" ? [] : ["user"]).concat(["title", "date"])
          );
        return {
            title: header.title
          , date: header.date
          , user: header.user || ""
          , content: $(row).find(".container-message-content").trim()
          , read: $(row).find("td.left").last().trim() !== "NIE"
        };
      }
    );
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
            'tak': "Tak"
          , 'id': 1
          , 'Wid': messageId
          , 'poprzednia': 6
        }
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
              'DoKogo': userId
            , 'temat': title
            , 'tresc': content
            , 'poprzednia': 6
            , 'wyslij': "Wy%C5%9Blij"
          }
        })
        .then(Inbox._getConfirmMessage);
    };
    return this.api.caller
      .get("wiadomosci/2/5", null, true)
      .then(sendPromise);
  }

  /**
   * Get recipient list from group
   * https://synergia.librus.pl/wiadomosci/2/5
   *
   * @returns {Promise}
   */
  listReceivers(group) {
    return this.api._mapper(
        "wiadomosci/2/5"
      , "td.message-recipients table.message-recipients-detail tr[class*='line']"
      , ($, row) => {
        return {
            id: parseInt($(row).find("input[name='DoKogo[]']").val())
          , user: $(row).find("label").trim()
        };
      }
      , "post"
      , {
        form: { 'adresat': group }
      });
  }

  /**
   * List inbox all messages headers
   * https://synergia.librus.pl/wiadomosci
   *
   * @param folderId  Folder number
   * @param page    Page index
   * @returns {Promise}
   */
  listInbox(folderId, page) {
    /** Before setting page script downloads container_number from input */
    let listPromise = $ => {
      /** Get current page */
      let container = $ && $("form[name='formWiadomosci'] input[name^='porcjowanie_pojemnik']").val()
        , total = -1;

      /** Page number and contauner */
      let postData = {
        form: {
            ['numer_strony' + container]: page
          , ['porcjowanie_pojemnik' + container]: container
        }
      };

      /** Parser */
      let parser = ($, row) => {
        if(total === -1)
          total = $("table.stretch.container-message .pagination ul").length;

        /** get data from table */
        let children = $(row).children("td");
        return {
            id: parseInt($(children[2]).find("a").attr("href").match(/\d*$/)[0])
          , user: $(children[1]).trim()
          , title: $(children[2]).trim()
          , date: $(children[3]).trim()
          , read: $(children[4]).makeBoolean()
        };
      };

      /** API call */
      return this.api
        ._mapper(
            `wiadomosci/${folderId}`
          , "table.container-message table.decorated.stretch tbody tr"
          , parser
          , "post"
          , postData
        )
        .then(array => {
          return {
            page: parseInt(page) || 0
          , total: total
          , list: array
          };
        });
    };
    return page
      ? this.api.caller.get(`wiadomosci/${folderId}`).then(listPromise)
      : listPromise();
  }

  /**
   * List all announcements
   * https://synergia.librus.pl/ogloszenia
   *
   * @returns {Promise}
   */
  listAnnouncements() {
    return this.api._mapper(
        "ogloszenia"
      , "form[name='formOgloszenia'] table.decorated.form"
      , ($, row) => {
        let cols = $(row).find("td");
        return {
            title: $(row).find("thead").trim()
          , user: $(cols[1]).trim()
          , date: $(cols[2]).trim()
          , content: $(cols[3]).trim()
        };
      });
  }
};