import { useState } from "react";
import { Account, deleteAccount } from "../api";
import AddAccountForm from "./AddAccountForm";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Button } from "./ui/button";

export default function AccountsList({
  accounts,
  onSelect,
  onAdded,
  onDeleted,
}: {
  accounts: Account[];
  onSelect: (account: Account) => void;
  onAdded: (account: Account) => void;
  onDeleted: (id: number) => void;
}) {
  const [showForm, setShowForm] = useState(false);

  async function handleDelete(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    try {
      await deleteAccount(id);
      onDeleted(id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Nie udało się usunąć konta");
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        {accounts.map((account) => (
          <Card
            key={account.id}
            className="w-48 cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => onSelect(account)}
          >
            <CardHeader>
              <CardTitle>{account.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" size="sm" onClick={(e) => handleDelete(e, account.id)}>
                Usuń
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {showForm ? (
        <AddAccountForm
          onAdded={(account) => {
            onAdded(account);
            setShowForm(false);
          }}
        />
      ) : (
        <Button onClick={() => setShowForm(true)} className="self-start">
          Dodaj konto
        </Button>
      )}
    </section>
  );
}
