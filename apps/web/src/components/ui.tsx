import type { ReactNode } from "react";

/**
 * Shared look of the parent pages: light, friendly and roomy. Violet is the brand color, white cards float on a soft background,
 * and buttons are big enough to tap. Every page uses these, so a change here changes the whole parent side.
 */
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600";
const buttonBase = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;

export const btn = {
  primary: `${buttonBase} bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm shadow-violet-300/50 hover:from-violet-500 hover:to-indigo-500`,
  secondary: `${buttonBase} bg-white text-violet-700 ring-1 ring-violet-200 hover:bg-violet-50`,
  link: `text-sm font-medium text-violet-700 underline-offset-2 hover:underline ${focus}`,
  danger: `text-sm font-medium text-rose-600 underline-offset-2 hover:underline ${focus}`,
};

export const field =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-100";

export const labelText = "block text-sm font-medium text-slate-700";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_30px_rgba(99,102,241,0.07)] ring-1 ring-slate-100 sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

export function CardHeader({ title, description, icon }: { title: string; description?: ReactNode; icon?: string }) {
  return (
    <div className="mb-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        {icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-base" aria-hidden="true">
            {icon}
          </span>
        )}
        {title}
      </h2>
      {description && <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{description}</p>}
    </div>
  );
}

const tones = {
  neutral: "bg-slate-100 text-slate-700",
  good: "bg-emerald-100 text-emerald-800",
  warn: "bg-amber-100 text-amber-800",
  bad: "bg-rose-100 text-rose-800",
};

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

const statTints = ["bg-violet-50 text-violet-900", "bg-emerald-50 text-emerald-900", "bg-sky-50 text-sky-900", "bg-amber-50 text-amber-900"];

export function Stat({ label, value, hint, tint = 0 }: { label: string; value: ReactNode; hint?: ReactNode; tint?: number }) {
  return (
    <div className={`rounded-2xl p-4 ${statTints[tint % statTints.length]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs opacity-70">{hint}</p>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6">
      {back && <div className="mb-3 text-sm">{back}</div>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

const avatarColors = [
  "from-violet-500 to-fuchsia-500",
  "from-sky-500 to-indigo-500",
  "from-emerald-500 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-rose-500 to-pink-500",
];

/** A colored circle with the kid's first letter. The color follows the name, so each kid keeps theirs. */
export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const cls = size === "lg" ? "h-14 w-14 text-2xl" : "h-11 w-11 text-lg";
  const hash = [...name].reduce((n, c) => n + c.charCodeAt(0), 0);
  return (
    <span className={`inline-flex ${cls} shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarColors[hash % avatarColors.length]} font-bold text-white shadow-sm`} aria-hidden>
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
