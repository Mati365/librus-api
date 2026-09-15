import { CalendarDays, UserPlus } from "lucide-react";
import { cn } from "cn";
import { Dock, DockIcon } from "./ui/dock";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "./ui/tooltip";

export type View = "calendar" | "messages" | "add";

type DockItem = {
  view: View;
  label: string;
  Icon: typeof CalendarDays;
};

const ITEMS: DockItem[] = [
  { view: "calendar", label: "Plan lekcji", Icon: CalendarDays },
  { view: "add", label: "Dodaj konto", Icon: UserPlus },
];

export default function AppDock({
  view,
  onChange,
}: {
  view: View;
  onChange: (view: View) => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center">
      <TooltipProvider>
        <Dock>
          {ITEMS.map(({ view: itemView, label, Icon }) => (
            <DockIcon key={itemView}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={label}
                    aria-current={view === itemView}
                    onClick={() => onChange(itemView)}
                    className={cn(
                      "flex size-full items-center justify-center rounded-full transition-colors",
                      view === itemView
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="size-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            </DockIcon>
          ))}
        </Dock>
      </TooltipProvider>
    </div>
  );
}
