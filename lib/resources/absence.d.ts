export = Absence;
declare class Absence extends tools.Resource {
    /**
     * Get absence info
     * https://synergia.librus.pl/przegladaj_nb/szczegoly
     *
     * @param id  Absence ID
     * @returns {Promise}
     */
    getAbsence(id: any): Promise<any>;
    /**
     * Get total user absence
     * https://synergia.librus.pl/przegladaj_nb/uczen
     *
     * @returns {Promise}
     */
    getAbsences(): Promise<any>;
}
import tools = require("../tools.js");
//# sourceMappingURL=absence.d.ts.map