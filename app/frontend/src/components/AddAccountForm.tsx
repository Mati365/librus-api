import { useState } from "react";
import { addAccount, Account } from "../api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Alert, AlertDescription } from "./ui/alert";

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
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-label">Etykieta</Label>
        <Input id="account-label" value={label} onChange={(e) => setLabel(e.target.value)} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-login">Login Synergia</Label>
        <Input id="account-login" value={login} onChange={(e) => setLogin(e.target.value)} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-password">Hasło Synergia</Label>
        <Input
          id="account-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Dodawanie…" : "Dodaj konto"}
      </Button>
    </form>
  );
}
