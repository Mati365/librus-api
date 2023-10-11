export = Homework;
declare class Homework extends Resource {
    /**
     * List all subjects in combobox
     * https://synergia.librus.pl/moje_zadania
     *
     * @returns {Promise}
     */
    listSubjects(): Promise<any>;
    /**
     * List homework
     * https://synergia.librus.pl/moje_zadania
     *
     * @param subjectId   Subject id
     * @param from        From date
     * @param to          To date
     * @returns {Promise}
     */
    listHomework(subjectId: any, from: any, to: any): Promise<any>;
    /**
     * Get homework description
     * https://synergia.librus.pl/moje_zadania/podglad/
     *
     * @param id   Homework id
     * @returns {Promise}
     */
    getHomework(id: any): Promise<any>;
}
import Resource_1 = require("../tools.js");
import Resource = Resource_1.Resource;
//# sourceMappingURL=homework.d.ts.map