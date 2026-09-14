import { useEffect, useState } from "react";
import { Account, getTimetable, Timetable } from "../api";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_LABELS: Record<string, string> = {
  Monday: "Poniedziałek",
  Tuesday: "Wtorek",
  Wednesday: "Środa",
  Thursday: "Czwartek",
  Friday: "Piątek",
  Saturday: "Sobota",
  Sunday: "Niedziela",
};

function mondayOf(date: Date): Date {
  const result = new Date(date);
  const daysSinceMonday = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - daysSinceMonday);
  return result;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export default function TimetableView({ account, onBack }: { account: Account; onBack: () => void }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [error, setError] = useState<string | null>(null);

  const monday = mondayOf(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  useEffect(() => {
    setError(null);
    setTimetable(null);
    getTimetable(account.id, formatDate(monday), formatDate(sunday))
      .then(setTimetable)
      .catch((err) => setError(err instanceof Error ? err.message : "Nie udało się pobrać planu"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id, weekOffset]);

  return (
    <section>
      <button onClick={onBack}>← Konta</button>
      <h2>{account.label}</h2>
      <div>
        <button onClick={() => setWeekOffset((w) => w - 1)}>← Poprzedni tydzień</button>
        <span>
          {formatDate(monday)} – {formatDate(sunday)}
        </span>
        <button onClick={() => setWeekOffset((w) => w + 1)}>Następny tydzień →</button>
      </div>

      {error && <p role="alert">{error}</p>}
      {!error && !timetable && <p>Ładowanie…</p>}

      {timetable && (
        <table>
          <thead>
            <tr>
              <th>Godzina</th>
              {DAYS.map((day) => (
                <th key={day}>{DAY_LABELS[day]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timetable.hours.map((hour, hourIndex) => (
              <tr key={hour + hourIndex}>
                <td>{hour}</td>
                {DAYS.map((day) => {
                  const lesson = timetable.table[day]?.[hourIndex];
                  return (
                    <td key={day}>
                      {lesson ? (
                        <>
                          <div>{lesson.subject}</div>
                          <div>
                            {lesson.teacher} {lesson.room}
                          </div>
                        </>
                      ) : (
                        ""
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
