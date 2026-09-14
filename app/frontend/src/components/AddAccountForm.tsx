import { useState } from "react";
import { addAccount, Account } from "../api";

export default function AddAccountForm({ onAdded }: { onAdded: (account: Account) => void }) {
  const [label, setLabel] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const account = await addAccount(label, login, password);
      setLabel("");
      setLogin("");
      setPassword("");
      onAdded(account);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się dodać konta");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>
          Etykieta
          <input value={label} onChange={(e) => setLabel(e.target.value)} required />
        </label>
      </div>
      <div>
        <label>
          Login Synergia
          <input value={login} onChange={(e) => setLogin(e.target.value)} required />
        </label>
      </div>
      <div>
        <label>
          Hasło Synergia
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Dodawanie…" : "Dodaj konto"}
      </button>
    </form>
  );
}
