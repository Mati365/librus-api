import { useEffect, useState } from "react";
import { Account, listMessages, Message } from "../api";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import MessageDialog from "./MessageDialog";

export default function MessagesCard({ account }: { account: Account }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Message | null>(null);

  useEffect(() => {
    setError(null);
    listMessages(account.id)
      .then(setMessages)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać wiadomości")
      );
  }, [account.id]);

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>{account.label}</CardTitle>
      </CardHeader>
      <CardContent className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!error && !messages && <p className="text-sm text-muted-foreground">Ładowanie…</p>}
        {!error && messages && messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Brak wiadomości.</p>
        )}
        {messages?.map((message) => (
          <button
            key={message.id}
            type="button"
            onClick={() => setSelected(message)}
            className="flex flex-col rounded-md p-1 text-left text-sm transition-colors hover:bg-muted/50"
          >
            <span className={message.read ? "" : "font-medium"}>{message.title}</span>
            <span className="text-muted-foreground">
              {message.user} · {message.date}
            </span>
          </button>
        ))}
        {selected && (
          <MessageDialog
            accountId={account.id}
            message={selected}
            open={selected !== null}
            onOpenChange={(next) => !next && setSelected(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}
