import { useState } from "react";
import { Account, deleteAccount } from "../api";
import AddAccountForm from "./AddAccountForm";

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
    await deleteAccount(id);
    onDeleted(id);
  }

  return (
    <section>
      <div className="tile-grid">
        {accounts.map((account) => (
          <button key={account.id} className="tile" onClick={() => onSelect(account)}>
            {account.label}
            <div>
              <a href="#" onClick={(e) => handleDelete(e, account.id)}>
                Usuń
              </a>
            </div>
          </button>
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
        <button onClick={() => setShowForm(true)}>Dodaj konto</button>
      )}
    </section>
  );
}
