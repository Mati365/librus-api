import { useEffect, useState } from "react";
import { Account, listAccounts } from "./api";
import AccountsList from "./components/AccountsList";
import TimetableView from "./components/TimetableView";

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

  if (loading) return <p>Ładowanie…</p>;

  return (
    <main>
      <h1>Plan lekcji Librus</h1>
      {error && <p role="alert">{error}</p>}
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
