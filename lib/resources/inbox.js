"use strict";

const cheerio = require('cheerio');
const config = require('../config.js');
const baseUrl = config.page_url;

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
   * Private function to extract class ID from wiadomosci/2/5 page
   * Looks for selectRecipients calls and extracts the last integer parameter
   * @returns {Promise<number>} Class ID
   */
  _getClassId() {
    return this.api._request('GET', 'wiadomosci/2/5').then(data => {
      const html = data.html();

      // Look for lines containing "false, 0" followed by a number (class ID)
      const lines = html.split('\n');

      for (const line of lines) {
        if (line.includes('false, 0')) {
          // Use regex to find the last integer in the line
          console.log("line", line);
          const matches = line.match(/\d+/g);
          if (matches && matches.length > 0) {
            console.log("matches", matches);

            const lastInteger = parseInt(matches[matches.length - 1]);
            // Only return if it's not 0 (which is the group parameter)
            if (lastInteger !== 0) {
              return lastInteger;
            }
          }
        }
      }
      return null;
    });
  }

  /**
   * Get recipient lists for all types
   * https://synergia.librus.pl/wiadomosci/2/5
   *
   * @param {number} groupId - Group ID (default: 0)
   * @param {boolean} isVirtualClasses - Whether to include virtual classes (default: false)
   * @returns {Promise<Object>} Object with recipient types as keys and arrays of recipients as values
   */
  listReceivers(groupId = 0, isVirtualClasses = false) {
    const recipientTypes = ['wychowawca', 'nauczyciel', 'bibliotekarz', 'sekretariat', 'admin'];

    // First, navigate to the page to get CSRF token
    return this.api._request('GET', 'wiadomosci/2/5').then(data => {
      // Extract CSRF token from the page
      const csrfTokenMatch = data.html().match(/var csrfTokenValue = "([^"]+)"/);
      if (!csrfTokenMatch) {
        throw new Error('CSRF token not found in page');
      }
      const csrfToken = csrfTokenMatch[1];

      // Get current cookies to add explicitly to headers
      return this.api.cookie.getCookies(baseUrl).then(currentCookies => {
        const dzienniksid = currentCookies.find(c => c.key === 'DZIENNIKSID');
        const sdzienniksid = currentCookies.find(c => c.key === 'SDZIENNIKSID');

        if (!dzienniksid || !sdzienniksid) {
          throw new Error('Required cookies not found');
        }

        const cookieHeader = `DZIENNIKSID=${dzienniksid.value}; SDZIENNIKSID=${sdzienniksid.value}`;

        // Make requests for all recipient types
        const axios = require('axios');
        const FormData = require('form-data');

        const requests = recipientTypes.map(recipientType => {
          const formData = new FormData();
          formData.append('typAdresata', recipientType);
          formData.append('poprzednia', '5');
          formData.append('tabZaznaczonych', '');
          formData.append('czyWirtualneKlasy', isVirtualClasses.toString());
          formData.append('idGrupy', groupId.toString());

          return axios.post(`${baseUrl}/getRecipients`, formData, {
            headers: {
              'X-Requested-With': 'XMLHttpRequest',
              'Referer': `${baseUrl}/wiadomosci/2/5`,
              'requestkey': csrfToken,
              'Cookie': cookieHeader,
              ...formData.getHeaders()
            }
          }).then(response => {
            // Parse the HTML response and extract recipients
            const $ = cheerio.load(response.data);
            const recipients = [];

            // Find recipient rows in the response
            $("table.message-recipients-detail tr[class*='line']").each((index, row) => {
              const $row = $(row);
              const id = parseInt($row.find("input[name='DoKogo[]']").val());
              const user = $row.find("label").text().trim();

              if (id && user) {
                recipients.push({
                  id: id,
                  user: user,
                  type: recipientType
                });
              }
            });

            return { type: recipientType, recipients };
          });
        });

        // Wait for all requests to complete
        return Promise.all(requests).then(results => {
          // Convert array of results to object
          const result = {};
          results.forEach(({ type, recipients }) => {
            result[type] = recipients;
          });
          return result;
        });
      });
    });
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
