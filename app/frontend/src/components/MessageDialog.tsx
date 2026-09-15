import { useEffect, useState } from "react";
import { getMessage, Message, MessageDetail } from "../api";
import { Alert, AlertDescription } from "./ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export default function MessageDialog({
  accountId,
  message,
  open,
  onOpenChange,
}: {
  accountId: number;
  message: Message;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [detail, setDetail] = useState<MessageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDetail(null);
    getMessage(accountId, message.id)
      .then(setDetail)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać wiadomości")
      );
  }, [open, accountId, message.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{message.title}</DialogTitle>
          <DialogDescription>
            {message.user} · {message.date}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!error && !detail && <p className="text-sm text-muted-foreground">Ładowanie…</p>}
        {detail && <p className="text-sm whitespace-pre-wrap">{detail.content}</p>}
      </DialogContent>
    </Dialog>
  );
}
