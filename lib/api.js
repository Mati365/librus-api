"use strict";

const request = require("request")
    , cheerio = require("cheerio")
    , _       = require("lodash");

const config = require("./config.js");

/** Export class */
class Librus {
  /**
   * Cretae Librus API client
   * @param cookies  Array of cookies
   */
  constructor(cookies) {
    this.cookie = request.jar();

    /**
     * Get cookies from array
     * TODO: Refactor
     */
    this.cookie.setCookie(request.cookie("TestCookie=1;"), config.page_url);
    _.each(cookies, val => {
      this.cookie.setCookie(request.cookie(`${val.key}=${val.value}`), config.page_url);
    });

    this.caller = {
        'get': _.bind(this._request, this, "get")
      , 'post': _.bind(this._request, this, "post")
    };
    this._loadModules([
        "inbox"
      , "homework"
      , "absence"
      , "calendar"
      , "info"
    ]);

    /**
     * Wraps _mapper function and get only one result
     * from call's return
     */
    this._singleMapper = _.wrap(this._mapper, function(func) {
      return func.apply(this, _.drop(arguments)).then(array => {
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
    this._tableMapper = _.wrap(this._singleMapper, function(func) {
      let keys = _.last(arguments)
        , args = _.chain(arguments);

      /** Get arguments list */
      let val = args
        /** remove first and last */
        .remove((val, index) => {
          return index && index !== arguments.length - 1;
        })

        /** add parser callback */
        .concat([
          ($, table) => { return Librus.mapTableValues(table, keys); }
        ])
        .value();

      /** call _singleMapper */
      return func.apply(this, val)
    });
  }

  /**
   * Load list of modules to app
   * @param modules Modules list
   * @private
   */
  _loadModules(modules) {
    _.each(modules, name => {
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
  authorize(login, pass) {
    return this.caller
      .post("loguj", {
        form: {
            'login': login
          , 'passwd': pass
          , 'ed_pass_keydown': ""
          , 'ed_pass_keyup': ""
          , 'captcha': ""
          , 'jest_captcha': 1
          , 'czy_js': 2
        }
      })
      .then(() => {
        return this.cookie.getCookies(config.page_url);
      });
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
    return new Promise(
      (resolve, reject) => {
        let handler = (err, response, body) => {
          if(!err)
            resolve(blank || cheerio.load(body));
          else
            reject(err);
        };

        /** Post data */
        let postData = _.extend({
            jar: this.cookie
          , gzip: true
          , headers: {
            'User-Agent': "User-Agent:Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.73 Safari/537.36"
          }
        }, data);

        /** Make request */
        request[method](`${config.page_url}/${apiFunction}`, postData, handler);
      }
    );
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
    return this
      ._request(method || "get", apiFunction, data)
      .then($ => {
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
      keys, _.map(cheerio(table).find("tr td:nth-child(2)"), row => {
        return cheerio(row).trim();
      })
    );
  }

  /**
   * Parse key => value table to javascript assoc
   * @param table DOM table
   * @returns {Array}
   */
  static tableValues(table) {
    return _
      .chain()
      .map(cheerio(table).find("tr"), row => {
        return [
            cheerio(row).children(0).trim()
          , cheerio(row).children(1).trim()
        ];
      })
      .zipObject()
      .value();
  }
}

/** Export */
module.exports = Librus;
