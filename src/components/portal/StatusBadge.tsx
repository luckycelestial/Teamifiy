const styles: Record<string, string> = {
  forming: "bg-muted text-muted-foreground",
  submitted: "bg-accent text-accent-foreground",
  approved: "bg-success/15 text-foreground",
  rejected: "bg-destructive/15 text-foreground",
  locked: "bg-navy text-white",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
        styles[status] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}
