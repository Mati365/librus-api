export = Inbox;
declare class Inbox extends Resource {
    /**
     * Get operation message
     * https://synergia.librus.pl/wiadomosci
     *
     * @param $ Page body
     * @returns {Promise}
     * @private
     */
    private static _getConfirmMessage;
    /**
     * Read message
     * https://synergia.librus.pl/wiadomosci/1
     *
     * @param folderId    Folder ID
     * @param messageId   Message ID
     * @returns {Promise}
     */
    getMessage(folderId: any, messageId: any): Promise<any>;
    getFile(path: any): any;
    /**
     * Remove message from inbox
     * https://synergia.librus.pl/wiadomosci
     *
     * @param messageId Message ID
     * @returns {Promise}
     */
    removeMessage(messageId: any): Promise<any>;
    /**
     * Send message to user
     * https://synergia.librus.pl/wiadomosci/2/5
     *
     * @param userId    User ID
     * @param title     Message title
     * @param content   Message content
     * @returns {Promise}
     */
    sendMessage(userId: any, title: any, content: any): Promise<any>;
    /**
     * Get recipient list from group
     * https://synergia.librus.pl/wiadomosci/2/5
     *
     * @returns {Promise}
     */
    listReceivers(group: any): Promise<any>;
    /**
     * List inbox all messages headers
     * https://synergia.librus.pl/wiadomosci
     *
     * @param folderId  Folder number
     * @returns {Promise}
     */
    listInbox(folderId: any): Promise<any>;
    /**
     * List all announcements
     * https://synergia.librus.pl/ogloszenia
     *
     * @returns {Promise}
     */
    listAnnouncements(): Promise<any>;
}
import Resource_1 = require("../tools.js");
import Resource = Resource_1.Resource;
//# sourceMappingURL=inbox.d.ts.map