import { useEffect, useState } from "react";
import { Account, getTimetable, Timetable } from "../api";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import TimetableDialog from "./TimetableDialog";
import { mondayOf, formatDate } from "../lib/week";

const DAY_KEYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DAY_LABELS: Record<string, string> = {
  Monday: "Poniedziałek",
  Tuesday: "Wtorek",
  Wednesday: "Środa",
  Thursday: "Czwartek",
  Friday: "Piątek",
};

// Saturday and Sunday are never school days, so the weekend points at the COMING Monday
// (+2 from Saturday, +1 from Sunday) — not the Monday of the week that is ending.
export function schoolDayFor(now: Date): { key: string; isToday: boolean; date: Date } {
  const day = now.getDay();
  if (day === 6 || day === 0) {
    const date = new Date(now);
    date.setDate(date.getDate() + (day === 6 ? 2 : 1));
    return { key: "Monday", isToday: false, date };
  }
  return { key: DAY_KEYS[day], isToday: true, date: new Date(now) };
}

export default function TodayCard({
  account,
  onDeleted,
}: {
  account: Account;
  onDeleted: (id: number) => void;
}) {
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const { key, isToday, date } = schoolDayFor(new Date());
  const monday = mondayOf(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const from = formatDate(monday);
  const to = formatDate(sunday);

  useEffect(() => {
    setError(null);
    getTimetable(account.id, from, to)
      .then(setTimetable)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać planu")
      );
  }, [account.id, from, to]);

  const lessons = timetable
    ? timetable.hours
        .map((hour, index) => ({ hour, lesson: timetable.table[key]?.[index] ?? null }))
        .filter((row) => row.lesson !== null)
    : [];

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        aria-label={`Plan lekcji — ${account.label}`}
        className="flex cursor-pointer flex-col transition-colors hover:bg-muted/50"
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <CardHeader>
          <CardTitle>{account.label}</CardTitle>
          <span className="text-sm text-muted-foreground">
            {isToday ? `Dziś — ${DAY_LABELS[key]}` : `Najbliższy dzień nauki — ${DAY_LABELS[key]}`}
          </span>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!error && !timetable && <p className="text-sm text-muted-foreground">Ładowanie…</p>}
          {!error && timetable && lessons.length === 0 && (
            <p className="text-sm text-muted-foreground">Brak lekcji.</p>
          )}
          {lessons.map(({ hour, lesson }) => (
            <div key={hour} className="flex gap-3 text-sm">
              <span className="w-28 shrink-0 text-muted-foreground">{hour}</span>
              <span className="flex flex-col">
                <span>{lesson!.subject}</span>
                <span className="text-muted-foreground">
                  {lesson!.teacher} {lesson!.room}
                </span>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
      <TimetableDialog
        account={account}
        initialTimetable={timetable}
        open={open}
        onOpenChange={setOpen}
        onDeleted={onDeleted}
      />
    </>
  );
}
