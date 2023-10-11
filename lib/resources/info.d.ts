export = Info;
interface Grade {
    id: number;
    value: number | "+" | "-" | "np" | "bz"; // TODO: add more types
}
interface Semester {
    grades: Grade[];
    tempAverage: number | null;
    average: number | null;
}
interface GradesSubject {
    name: string;
    semester: Semester[];
    average: number | null;
    tempAverage: number | null;
}
interface GradesData extends Array<GradesSubject> {}
interface SingleGrade {
    grade: string;
    category: string;
    date: string;
    teacher: string;
    lesson: string;
    inAverage: boolean;
    multiplier: string;
    user: string;
    comment: string;
}
interface AccountInfo {
    student: {
        nameSurname: string;
        class: string;
        index: string;
        educator: string;
    },
    account: {
        nameSurname: string;
        login: string;
    }
}
interface Notifications {
    grades: number;
    absence: number;
    inbox: number;
    announcements: number;
    calendar: number;
    homework: number;
}
declare class Info extends Resource {
    /**
     * Get notifications
     * https://synergia.librus.pl/uczen_index
     *
     * @returns {Promise}
     */
    getNotifications(): Promise<Notifications>;
    getAccountInfo(): AccountInfo;
    /**
     * Get grade info
     * https://synergia.librus.pl/przegladaj_oceny/szczegoly
     *
     * @param gradeId Grade ID
     * @returns {Promise}
     */
    getGrade(gradeId: number): Promise<SingleGrade>;
    /**
     * Get Point grade info
     * https://synergia.librus.pl/przegladaj_oceny_punktowe/szczegoly
     *
     * @param gradeId Grade ID
     * @returns {Promise}
     */
    getPointGrade(gradeId: number): Promise<number>; // I'm not sure
    /**
     * Get lucky number
     * https://synergia.librus.pl/uczen/index
     *
     * @returns {Promise}
     */
    getLuckyNumber(): Promise<number>;
    /**
     * Get grades list
     * https://synergia.librus.pl/przegladaj_oceny/uczen
     *
     * @returns {Promise}
     */
    getGrades(): Promise<GradesData>;
}
import Resource_1 = require("../tools.js");
import Resource = Resource_1.Resource;
//# sourceMappingURL=info.d.ts.map