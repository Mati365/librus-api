import { useEffect, useState } from "react";
import { Account, getTimetable, Timetable } from "../api";
import { Button } from "./ui/button";
import { Alert, AlertDescription } from "./ui/alert";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./ui/table";
import { Card, CardContent } from "./ui/card";

// Saturday and Sunday are always school-free days in Librus timetables, so they're
// omitted from the grid entirely rather than shown as permanently empty columns.
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAY_LABELS: Record<string, string> = {
  Monday: "Poniedziałek",
  Tuesday: "Wtorek",
  Wednesday: "Środa",
  Thursday: "Czwartek",
  Friday: "Piątek",
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

export default function TimetableView({
  account,
  initialTimetable,
}: {
  account: Account;
  initialTimetable: Timetable | null;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [timetable, setTimetable] = useState<Timetable | null>(initialTimetable);
  const [error, setError] = useState<string | null>(null);

  const monday = mondayOf(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  useEffect(() => {
    if (weekOffset === 0 && initialTimetable) {
      setError(null);
      setTimetable(initialTimetable);
      return;
    }
    setError(null);
    setTimetable(null);
    getTimetable(account.id, formatDate(monday), formatDate(sunday))
      .then(setTimetable)
      .catch((err) => setError(err instanceof Error ? err.message : "Nie udało się pobrać planu"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id, weekOffset]);

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w - 1)}>
          ← Poprzedni tydzień
        </Button>
        <span className="text-sm text-muted-foreground">
          {formatDate(monday)} – {formatDate(sunday)}
        </span>
        <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w + 1)}>
          Następny tydzień →
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!error && !timetable && <p className="text-sm text-muted-foreground">Ładowanie…</p>}

      {timetable && (
        <Card className="min-w-0">
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Godzina</TableHead>
                  {DAYS.map((day) => (
                    <TableHead key={day}>{DAY_LABELS[day]}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {timetable.hours.map((hour, hourIndex) => (
                  <TableRow key={hour + hourIndex}>
                    <TableCell>{hour}</TableCell>
                    {DAYS.map((day) => {
                      const lesson = timetable.table[day]?.[hourIndex];
                      return (
                        <TableCell key={day}>
                          {lesson ? (
                            <>
                              <div>{lesson.subject}</div>
                              <div className="text-muted-foreground">
                                {lesson.teacher} {lesson.room}
                              </div>
                            </>
                          ) : (
                            ""
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
