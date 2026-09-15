import { Account, deleteAccount, Timetable } from "../api";
import TimetableView from "./TimetableView";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export default function TimetableDialog({
  account,
  initialTimetable,
  open,
  onOpenChange,
  onDeleted,
}: {
  account: Account;
  initialTimetable: Timetable | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (id: number) => void;
}) {
  async function handleDelete() {
    try {
      await deleteAccount(account.id);
      onOpenChange(false);
      onDeleted(account.id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Nie udało się usunąć konta");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{account.label}</DialogTitle>
          <DialogDescription>Plan lekcji na cały tydzień</DialogDescription>
        </DialogHeader>
        <TimetableView account={account} initialTimetable={initialTimetable} />
        <Button variant="ghost" size="sm" onClick={handleDelete} className="self-start">
          Usuń to konto
        </Button>
      </DialogContent>
    </Dialog>
  );
}
