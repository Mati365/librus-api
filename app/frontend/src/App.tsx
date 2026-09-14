import { useEffect, useState } from "react";
import { Account, listAccounts } from "./api";
import AccountsList from "./components/AccountsList";

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAccounts()
      .then(setAccounts)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Ładowanie…</p>;

  return (
    <main>
      <h1>Plan lekcji Librus</h1>
      <AccountsList
        accounts={accounts}
        onSelect={() => {}}
        onAdded={(account) => setAccounts((prev) => [...prev, account])}
        onDeleted={(id) => setAccounts((prev) => prev.filter((a) => a.id !== id))}
      />
    </main>
  );
}
