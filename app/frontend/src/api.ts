const BASE = "/api/accounts";

export interface Account {
  id: number;
  label: string;
  login: string;
}

export interface TimetableLesson {
  subject: string;
  teacher: string;
  room: string;
  time: string;
}

export interface Timetable {
  hours: string[];
  table: Record<string, (TimetableLesson | null)[]>;
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export function listAccounts(): Promise<Account[]> {
  return fetch(BASE).then((res) => asJson<Account[]>(res));
}

export function addAccount(label: string, login: string, password: string): Promise<Account> {
  return fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, login, password }),
  }).then((res) => asJson<Account>(res));
}

export async function deleteAccount(id: number): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete account ${id}`);
}

export function getTimetable(id: number, from?: string, to?: string): Promise<Timetable> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();
  return fetch(`${BASE}/${id}/timetable${query ? `?${query}` : ""}`).then((res) =>
    asJson<Timetable>(res)
  );
}
