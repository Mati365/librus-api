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
   * @param options  Request and attachment polling options
   */
  constructor(cookies, options = {}) {
    this.cookie = new CookieJar();
    this.options = Object.assign(
      {
        requestTimeout: 30000,
        filePollAttempts: 10,
        filePollDelay: 500,
      },
      options
    );

    /**
     * Get cookies from array
     * TODO: Refactor
     */
    this.cookie.setCookie("TestCookie=1;", config.page_url);

    // Initialize caller asynchronously
    this._callerReady = this._initializeCaller();
    this._initializeMappers();
    this._loadModules(["inbox", "homework", "absence", "calendar", "info"]);
  }

  /**
   * Initialize the axios caller with cookie support
   * @private
   */
  async _initializeCaller() {
    const { wrapper } = await import("axios-cookiejar-support");
    const timeoutOption = Number(this.options?.requestTimeout);
    const timeout = Number.isFinite(timeoutOption) && timeoutOption > 0
      ? Math.min(timeoutOption, 120000)
      : 30000;
    this.caller = wrapper(
      axios.create({
        jar: this.cookie,
        withCredentials: true,
        timeout,
        maxContentLength: 10 * 1024 * 1024,
        maxBodyLength: 1024 * 1024,
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
      await (this._callerReady || this._initializeCaller());
    }

    let caller = this.caller;

    // Step 1: portalRodzina redirects to the OAuth authorization page
    const r1 = await caller.get("https://synergia.librus.pl/loguj/portalRodzina", {
      headers: { Referer: "https://portal.librus.pl/" }
    });

    // Step 2: POST credentials to the page we landed on after the redirect
    const loginUrl = r1.request?.res?.responseUrl || "https://api.librus.pl/OAuth/Authorization?client_id=46";
    const loginResponse = await caller.postForm(loginUrl, {
      action: "login",
      login: login,
      pass: pass,
    });

    // Step 3: GET the 2FA/next URL returned in the JSON response.
    // The server skips 2FA and redirects to synergia.librus.pl with the OAuth code,
    // which sets the session cookies automatically.
    const nextUrl = "https://api.librus.pl" + loginResponse.data.goTo;
    await caller.get(nextUrl);

    return this.cookie.getCookies(config.page_url);
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
    const target = this._safeLibrusUrl(path, config.page_url + "/");

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
      const location = response.headers.location;
      if (!location) {
        throw new Error("Attachment response did not contain a redirect location.");
      }
      const redirect = this._safeLibrusUrl(location, target);
      // For some reason files may be served in two totally different ways...
      if (redirect.includes("GetFile")) {
        const url = redirect.replace(/\/?$/, "/get");
        return this.caller.get(url, options1).then((response) => { return response.data });
      } else {
        const key = new URL(redirect).searchParams.get("singleUseKey");
        if (!key) throw new Error("Attachment redirect did not contain a single-use key.");
        return this._waitForFileReady(key, options1, redirect);
      }
    });
  }

  _safeLibrusUrl(value, base) {
    const url = new URL(value, base);
    const librusHost = url.hostname === "librus.pl" || url.hostname.endsWith(".librus.pl");
    const defaultPort = !url.port || url.port === "443";
    if (
      url.protocol !== "https:" ||
      !librusHost ||
      !defaultPort ||
      url.username ||
      url.password
    ) {
      throw new Error("Attachment URL must use HTTPS on a librus.pl host.");
    }
    return url.toString();
  }

  _sleep(delay) {
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Wait for a file to be ready and download it
   * @param key        Single use file key
   * @param options    Request options
   * @param redirect   Download attempt URL
   * @returns {String}
   */
  async _waitForFileReady(key, options, redirect) {
    const checkKey = "https://sandbox.librus.pl/index.php?action=CSCheckKey";
    const attemptsOption = Number(this.options?.filePollAttempts);
    const delayOption = Number(this.options?.filePollDelay);
    const attempts = Number.isFinite(attemptsOption) && attemptsOption > 0
      ? Math.min(100, Math.floor(attemptsOption))
      : 10;
    const delay = Number.isFinite(delayOption) && delayOption >= 0
      ? Math.min(60000, delayOption)
      : 500;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const response = await this.caller.postForm(
        checkKey,
        { singleUseKey: key },
        {
        headers: {
          "User-Agent":
            "User-Agent:Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.73 Safari/537.36",
        },
        }
      );
      const data = response.data;
      const ready = data?.status === "ready" || (typeof data === "string" && data.includes("ready"));
      if (ready) {
        const url = this._safeLibrusUrl(
          redirect.replace("CSTryToDownload", "CSDownload")
        );
        const download = await this.caller.get(url, options);
        return download.data;
      }
      if (attempt < attempts) await this._sleep(delay);
    }
    throw new Error(`Attachment was not ready after ${attempts} attempts.`);
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
