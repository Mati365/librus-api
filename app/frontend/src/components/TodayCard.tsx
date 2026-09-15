import { useEffect, useState } from "react";
import { Account, getTimetable, Timetable } from "../api";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";

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

// Saturday and Sunday are never school days, so the weekend shows the coming Monday instead.
export function schoolDayFor(now: Date): { key: string; isToday: boolean } {
  const day = now.getDay();
  if (day === 0 || day === 6) return { key: "Monday", isToday: false };
  return { key: DAY_KEYS[day], isToday: true };
}

export default function TodayCard({ account }: { account: Account }) {
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    getTimetable(account.id)
      .then(setTimetable)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać planu")
      );
  }, [account.id]);

  const { key, isToday } = schoolDayFor(new Date());
  const lessons = timetable
    ? timetable.hours
        .map((hour, index) => ({ hour, lesson: timetable.table[key]?.[index] ?? null }))
        .filter((row) => row.lesson !== null)
    : [];

  return (
    <Card className="flex flex-col">
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
  );
}
