"use strict";

const cheerio = require("cheerio"),
  _ = require("lodash"),
  { CookieJar } = require("tough-cookie"),
  axios = require("axios");

const config = require("./config.js");
const { makeBoolean } = require("./tools.js");

/** Export class */
class Librus {
  /**
   * Create Librus API client
   * @param cookies  Array of cookies
   */
  constructor(cookies) {
    this.cookie = new CookieJar();

    /**
     * Get cookies from array
     * TODO: Refactor
     */
    this.cookie.setCookie("TestCookie=1;", config.page_url);

    // Initialize caller asynchronously
    this._initializeCaller();
    this._initializeMappers();
    this._loadModules(["inbox", "homework", "absence", "calendar", "info"]);
  }

  /**
   * Initialize the axios caller with cookie support
   * @private
   */
  async _initializeCaller() {
    const { wrapper } = await import("axios-cookiejar-support");
    this.caller = wrapper(
      axios.create({
        jar: this.cookie,
        withCredentials: true,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Referer": "https://portal.librus.pl/rodzina/synergia/loguj",
        },
      })
    );
  }

  /**
   * Wraps _mapper function and get only one result
   * from call's return
   */
  _initializeMappers() {
    this._singleMapper = _.wrap(this._mapper, function (func) {
      return func.apply(this, _.drop(arguments)).then((array) => {
        return array.length && array[0];
      });
    });

    /**
     * Two column table map
     * @param apiFunction Librus API method
     * @param cssPath     CSS Path to parsed element
     * @param array       Keys
     * @returns {Promise}
     */
    this._tableMapper = _.wrap(this._singleMapper, function (func) {
      let keys = _.last(arguments),
        args = _.chain(arguments);

      /** Get arguments list */
      let val = args
        /** remove first and last */
        .remove((val, index) => {
          return index && index !== arguments.length - 1;
        })

        /** add parser callback */
        .concat([
          ($, table) => {
            if (Array.isArray(keys)) {
              return Librus.mapTableValues($(table), keys);
            } else {
              return Librus.tableValues($(table), keys);
            }
          },
        ])
        .value();

      /** call _singleMapper */
      return func.apply(this, val);
    });
  }

  /**
   * Load list of modules to app
   * @param modules Modules list
   * @private
   */
  _loadModules(modules) {
    _.each(modules, (name) => {
      let module = require(`./resources/${name}.js`);
      this[name] = new module(this);
    });
  }

  /**
   * Authorize to Librus
   * @param login User login
   * @param pass  User password
   * @returns {Promise}
   */
  async authorize(login, pass) {
    // Ensure caller is initialized
    if (!this.caller) {
      await this._initializeCaller();
    }

    let caller = this.caller;
    return caller
      .get(
        "https://api.librus.pl/OAuth/Authorization?client_id=46&response_type=code&scope=mydata"
      )
      .then(() => {
        return caller.postForm(
          "https://api.librus.pl/OAuth/Authorization?client_id=46",
          {
            action: "login",
            login: login,
            pass: pass,
          }
        );
      })
      .then(() => {
        return caller
          .get("https://api.librus.pl/OAuth/Authorization/2FA?client_id=46")
          .then(() => {
            return this.cookie.getCookies(config.page_url);
          });
      })
      .catch(console.error);
  }

  /**
   * Make request to server
   * @param method        REST method
   * @param apiFunction   Librus API method
   * @param data          Form data
   * @param blank         Return blank message
   * @returns {Promise}
   * @private
   */
  _request(method, apiFunction, data, blank) {
    /** Make request */
    const target = apiFunction.startsWith("https://")
      ? apiFunction
      : config.page_url + "/" + apiFunction;
    return this.caller
      .request({
        method,
        url: target,
        data,
      })
      .then(({ data }) => Librus._loadDocument(data));
  }

  /**
   * Download a message attachment
   * @param path   Path to the file as specified on the message view (wiadomosci/pobierz_zalacznik/<message id>/<file id>)
   * @returns {String}
   */
  _getFile(path) {
    let target = path.startsWith("https://")
      ? path
      : config.page_url + "/" + path;

    let options1 = {
      headers: {
        "User-Agent":
          "User-Agent:Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.73 Safari/537.36",
      },
      responseType: 'stream',
    };

    let options2 = {
      maxRedirects: 0,
      simple: false,
      validateStatus: null,
      resolveWithFullResponse: true,
      headers: {
        "User-Agent":
          "User-Agent:Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.73 Safari/537.36",
      },
    };

    /** Make request */
    return this.caller.get(target, options2).then((response) => {
      let redirect = response.headers.location,
        url = null;
      // For some reason files may be served in two totally different ways...
      if (redirect.includes("GetFile")) {
        url = redirect + "/get";
        return this.caller.get(url, options1).then((response) => { return response.data });
      } else {
        const key = new URL(redirect).searchParams.get("singleUseKey");
        return this._waitForFileReady(key, options1, redirect);
      }
    });
  }

  /**
   * Wait for a file to be ready and download it
   * @param key        Single use file key
   * @param options    Request options
   * @param redirect   Download attempt URL
   * @returns {String}
   */
  _waitForFileReady(key, options, redirect) {
    const checkKey = "https://sandbox.librus.pl/index.php?action=CSCheckKey";
    return this.caller.postForm(checkKey, {
        singleUseKey: key,
      },
      {
        headers: {
          "User-Agent":
            "User-Agent:Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.73 Safari/537.36",
        },
      }
    ).then((response) => {
      if (response.data.status === "ready" || (typeof response.data.inclues === "function" && response.data.includes("ready"))) {
        let url = redirect.replace("CSTryToDownload", "CSDownload");
        return this.caller.get(url, options).then((response) => { return response.data });
      } else {
        return this._waitForFileReady(key, options, redirect);
      }
    });
  }

  /**
   * Creates querying function and adds utility functions
   * @param {string} Input HTML
   * @returns {cheerio.CheerioAPI} document
   */
  static _loadDocument(document) {
    const $ =  cheerio.load(document)
    $.prototype.trim = function () {
      return this.text().trim()
    };

    $.prototype.makeBoolean = function () {
      return makeBoolean(this.trim())
    };

    return $
  }

  /**
   * Map array values to array using parser
   * @param $       Document
   * @param parser  Parser callback
   * @param cssPath CSS path to DOM element
   * @returns {Array}
   */
  static arrayMapper($, parser, cssPath) {
    return _.compact(_.map($(cssPath), _.partial(parser, $)));
  }

  /**
   * Parse request and map output data to array
   * @param apiFunction Librus API method
   * @param cssPath     CSS Path to parsed element
   * @param parser      Parser callback
   * @param method      REST method
   * @param data        Form data
   * @returns {Promise}
   * @private
   */
  _mapper(apiFunction, cssPath, parser, method, data) {
    return this._request(method || "get", apiFunction, data).then(($) => {
      return Librus.arrayMapper($, parser, cssPath);
    });
  }

  /**
   * Map two columns forms values
   * @param table   Table DOM
   * @param keys    Table keys
   * @returns {Array}
   * @example
   *
   * <tr><td>Id:</td><td>23</td></tr>
   * <tr><td>Name:</td><td>test</td></tr>
   *
   * mapTableValues(dom, ["id", "name"])
   * // => { id: 23, name: "test" }
   */
  static mapTableValues(table, keys) {
    return _.zipObject(
      keys,
      _.map(table.find("tr td:nth-child(2)"), (row) => {
        return Librus._loadDocument(row).text().trim();
      })
    );
  }

  /**
   * Parse key => value table to javascript assoc
   * @param table DOM table
   * @returns {Array}
   */
  static tableValues(table) {
    return _.chain()
      .map(cheerio(table).find("tr"), (row) => {
        return [
          cheerio.default(row).children(0).text().trim(),
          cheerio.default(row).children(1).text().trim(),
        ];
      })
      .zipObject()
      .value();
  }
  /**
   * Parse key => value table to javascript assoc
   * @param table DOM table
   * @param keys translation object for keys
   * @returns {Array}
   */
  static tableValues(table, keys) {
    return _.zipObject(
      _.map(table.find("tbody th"), (row) => keys[_.get(row, "children[0].data", "").trim()]),
      _.map(table.find("tbody td"), (row) =>
        _.map(row.children, (child) =>
          child.type === "text" ? _.get(child, "data", "").trim() : "\n"
        ).join("")
      )
    );
  }
}

/** Export */
module.exports = Librus;
