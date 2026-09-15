import { useEffect, useState } from "react";
import { Account, listMessages, Message } from "../api";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";

export default function MessagesCard({ account }: { account: Account }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          <div key={message.id} className="flex flex-col text-sm">
            <span className={message.read ? "" : "font-medium"}>{message.title}</span>
            <span className="text-muted-foreground">
              {message.user} · {message.date}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
