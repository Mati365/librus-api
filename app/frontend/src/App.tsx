import { useEffect, useState } from "react";
import { Account, listAccounts } from "./api";
import AddAccountForm from "./components/AddAccountForm";
import AppDock, { View } from "./components/AppDock";
import TodayCard from "./components/TodayCard";
import { Alert, AlertDescription } from "./components/ui/alert";
import { BentoGrid } from "./components/ui/bento-grid";

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("calendar");

  useEffect(() => {
    listAccounts()
      .then(setAccounts)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Nie udało się załadować kont")
      )
      .finally(() => setLoading(false));
  }, []);

  function handleAdded(account: Account) {
    setAccounts((prev) => [...prev, account]);
    setView("calendar");
  }

  if (loading) return <p className="text-sm text-muted-foreground">Ładowanie…</p>;

  return (
    <main className="flex flex-col gap-4 pb-28">
      <h1 className="font-heading text-2xl font-medium">Plan lekcji Librus</h1>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {view === "add" && (
        <div className="max-w-sm">
          <AddAccountForm onAdded={handleAdded} />
        </div>
      )}

      {view === "calendar" &&
        (accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Dodaj pierwsze konto Librus, żeby zobaczyć plan lekcji.
          </p>
        ) : (
          <BentoGrid className="grid-cols-1 auto-rows-auto md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account) => (
              <TodayCard key={account.id} account={account} />
            ))}
          </BentoGrid>
        ))}

      <AppDock view={view} onChange={setView} />
    </main>
  );
}
