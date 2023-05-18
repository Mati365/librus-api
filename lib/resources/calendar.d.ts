export = Calendar;
declare class Calendar extends Resource {
    /**
     * Get event description
     * https://synergia.librus.pl/terminarz/szczegoly
     *
     * @param id  Event ID
     * @param isAbsence Make it 'true' if the event is teacher's absence
     * @returns {Promise}
     */
    getEvent(id: any, isAbsence?: boolean): Promise<any>;
    /**
     * Get all calendar data
     * https://synergia.librus.pl/terminarz
     *
     * @returns {Promise}
     * @param month Choose calendar month (1-12)
     */
    getCalendar(month: any): Promise<any>;
    /**
     * Get school timetable
     * https://synergia.librus.pl/przegladaj_plan_lekcji
     *
     * @param from  From date e.g. 2015-12-14
     * @param to    To date e.g. 2015-12-21
     * @returns {Promise}
     */
    getTimetable(from: any, to: any): Promise<any>;
}
import Resource_1 = require("../tools.js");
import Resource = Resource_1.Resource;
//# sourceMappingURL=calendar.d.ts.map