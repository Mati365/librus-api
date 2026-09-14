import { useEffect, useState } from "react";
import { Account, listAccounts } from "./api";
import AccountsList from "./components/AccountsList";
import TimetableView from "./components/TimetableView";
import { Alert, AlertDescription } from "./components/ui/alert";

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAccounts()
      .then(setAccounts)
      .catch((err) => setError(err instanceof Error ? err.message : "Nie udało się załadować kont"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Ładowanie…</p>;

  return (
    <main className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl font-medium">Plan lekcji Librus</h1>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {selected ? (
        <TimetableView account={selected} onBack={() => setSelected(null)} />
      ) : (
        <AccountsList
          accounts={accounts}
          onSelect={setSelected}
          onAdded={(account) => setAccounts((prev) => [...prev, account])}
          onDeleted={(id) => setAccounts((prev) => prev.filter((a) => a.id !== id))}
        />
      )}
    </main>
  );
}
