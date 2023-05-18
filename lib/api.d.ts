export = Librus;
/** Export class */
declare class Librus {
    /**
     * Map array values to array using parser
     * @param $       Document
     * @param parser  Parser callback
     * @param cssPath CSS path to DOM element
     * @returns {Array}
     */
    static arrayMapper($: any, parser: any, cssPath: any): any[];
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
    static mapTableValues(table: any, keys: any): any[];
    /**
     * Parse key => value table to javascript assoc
     * @param table DOM table
     * @returns {Array}
     */
    static tableValues(table: any): any[];
    /**
     * Create Librus API client
     * @param cookies  Array of cookies
     */
    constructor(cookies: any);
    cookie: any;
    caller: any;
    /**
     * Wraps _mapper function and get only one result
     * from call's return
     */
    _singleMapper: any;
    /**
     * Two column table map
     * @param apiFunction Librus API method
     * @param cssPath     CSS Path to parsed element
     * @param array       Keys
     * @returns {Promise}
     */
    _tableMapper: any;
    /**
     * Load list of modules to app
     * @param modules Modules list
     * @private
     */
    private _loadModules;
    /**
     * Authorize to Librus
     * @param login User login
     * @param pass  User password
     * @returns {Promise}
     */
    authorize(login: any, pass: any): Promise<any>;
    /**
     * Make request to server
     * @param method        REST method
     * @param apiFunction   Librus API method
     * @param data          Form data
     * @param blank         Return blank message
     * @returns {Promise}
     * @private
     */
    private _request;
    /**
     * Download a message attachment
     * @param path   Path to the file as specified on the message view (wiadomosci/pobierz_zalacznik/<message id>/<file id>)
     * @returns {String}
     */
    _getFile(path: any): string;
    /**
     * Wait for a file to be ready and download it
     * @param key        Single use file key
     * @param options    Request options
     * @param redirect   Download attempt URL
     * @returns {String}
     */
    _waitForFileReady(key: any, options: any, redirect: any): string;
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
    private _mapper;
}
//# sourceMappingURL=api.d.ts.map