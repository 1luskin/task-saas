import { forwardRef } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ className, children, white }: { className?: string; children: React.ReactNode; white?: boolean }) {
  return <div className={cx(white ? "card-white" : "card", className)}>{children}</div>;
}

export function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...p },
  ref,
) {
  return <input ref={ref} className={cx("input", className)} {...p} />;
});

export function Textarea({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx("input min-h-24 py-3", className)} {...p} />;
}

export function Select({ className, children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx("input appearance-none bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%236a7178'%3E%3Cpath d='M5.5 7.5 10 12l4.5-4.5'/%3E%3C/svg%3E\")" }} {...p}>
      {children}
    </select>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-10 text-center text-muted">{children}</div>;
}

export function PageTitle({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  new: "bg-[#e9ebee] text-[#59626b]",
  in_progress: "bg-accent-soft text-accent",
  done: "bg-ok-soft text-ok",
};
export const STATUS_DOT: Record<string, string> = {
  new: "bg-st-new",
  in_progress: "bg-st-progress",
  done: "bg-st-done",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span className={cx("chip", STATUS_STYLE[status])}>
      <span className={cx("size-1.5 rounded-full", STATUS_DOT[status])} />
      {label}
    </span>
  );
}

export function UrgentBadge({ label }: { label: string }) {
  return <span className="chip bg-danger text-white">⚑ {label}</span>;
}

export function OverdueBadge({ label }: { label: string }) {
  return <span className="chip bg-danger-soft text-danger">{label}</span>;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]![0] : "")).toUpperCase();
}

export function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
  return (
    <span className={cx("inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent", className)}>
      {initials(name)}
    </span>
  );
}

export function Stat({ label, value, tone, href }: { label: string; value: React.ReactNode; tone?: "danger" | "accent"; href?: string }) {
  const inner = (
    <>
      <div className="text-sm leading-tight text-muted">{label}</div>
      <div className={cx("mt-1 whitespace-nowrap text-2xl font-semibold tracking-tight sm:text-3xl", tone === "danger" && "text-danger", tone === "accent" && "text-accent")}>{value}</div>
    </>
  );
  return href ? (
    <a href={href} className="card-white block min-w-0 p-3 transition hover:border-accent/40 sm:p-4">
      {inner}
    </a>
  ) : (
    <div className="card-white min-w-0 p-3 sm:p-4">{inner}</div>
  );
}
