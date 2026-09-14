import { useEffect, useState } from "react";
import { Account, listAccounts } from "./api";
import AddAccountForm from "./components/AddAccountForm";
import TimetableView from "./components/TimetableView";
import { Alert, AlertDescription } from "./components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";

const ADD_TAB = "add";

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(ADD_TAB);

  useEffect(() => {
    listAccounts()
      .then((loaded) => {
        setAccounts(loaded);
        setActiveTab(loaded.length ? String(loaded[0].id) : ADD_TAB);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Nie udało się załadować kont"))
      .finally(() => setLoading(false));
  }, []);

  function handleAdded(account: Account) {
    setAccounts((prev) => [...prev, account]);
    setActiveTab(String(account.id));
  }

  function handleDeleted(id: number) {
    const next = accounts.filter((a) => a.id !== id);
    setAccounts(next);
    if (activeTab === String(id)) {
      setActiveTab(next.length ? String(next[0].id) : ADD_TAB);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Ładowanie…</p>;

  return (
    <main className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl font-medium">Plan lekcji Librus</h1>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {accounts.length === 0 ? (
        <div className="flex max-w-sm flex-col gap-3">
          <p className="text-sm text-muted-foreground">Dodaj pierwsze konto Librus, żeby zobaczyć plan lekcji.</p>
          <AddAccountForm onAdded={handleAdded} />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {accounts.map((account) => (
              <TabsTrigger key={account.id} value={String(account.id)}>
                {account.label}
              </TabsTrigger>
            ))}
            <TabsTrigger value={ADD_TAB}>+ Dodaj konto</TabsTrigger>
          </TabsList>

          {accounts.map((account) => (
            <TabsContent key={account.id} value={String(account.id)}>
              <TimetableView account={account} onDeleted={handleDeleted} />
            </TabsContent>
          ))}
          <TabsContent value={ADD_TAB}>
            <AddAccountForm onAdded={handleAdded} />
          </TabsContent>
        </Tabs>
      )}
    </main>
  );
}
