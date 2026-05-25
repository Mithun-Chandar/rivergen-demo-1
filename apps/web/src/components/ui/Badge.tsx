type BadgeVariant = "live" | "offline" | "ok" | "error" | "skipped" | "default" | "alice" | "bob";

export function Badge({
  variant = "default",
  children,
}: {
  variant?: BadgeVariant;
  children: React.ReactNode;
}) {
  return <span className={`badge is-${variant}`}>{children}</span>;
}
