import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/login/actions";
import { LiveAlerts } from "@/components/LiveAlerts";

const nav = [
  { href: "/dashboard", label: "Kids", icon: "🏠" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

/** Header, page container and (on phones) a tab bar for every signed-in parent page. */
export function ParentShell({ children, width = "max-w-5xl" }: { children: ReactNode; width?: string }) {
  return (
    <div className="min-h-screen pb-24 sm:pb-0">
      <LiveAlerts />
      <header className="sticky top-0 z-30 border-b border-violet-100 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-lg text-white shadow-sm" aria-hidden="true">
              ✓
            </span>
            Study Plan
          </Link>
          <nav className="hidden items-center gap-1 text-sm sm:flex" aria-label="Main">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2 font-medium text-slate-600 hover:bg-violet-50 hover:text-violet-700">
                {n.label}
              </Link>
            ))}
            <form action={signOut}>
              <button className="rounded-lg px-3 py-2 font-medium text-slate-500 hover:bg-slate-100">Sign out</button>
            </form>
          </nav>
        </div>
      </header>
      <main className={`mx-auto w-full ${width} px-4 py-6 sm:px-6 sm:py-8`}>{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-violet-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden" aria-label="Main">
        <ul className="mx-auto flex max-w-md">
          {nav.map((n) => (
            <li key={n.href} className="flex-1">
              <Link href={n.href} className="flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold text-slate-600 active:bg-violet-50">
                <span className="text-xl" aria-hidden="true">
                  {n.icon}
                </span>
                {n.label}
              </Link>
            </li>
          ))}
          <li className="flex-1">
            <form action={signOut}>
              <button className="flex w-full flex-col items-center gap-0.5 py-2.5 text-xs font-semibold text-slate-500 active:bg-slate-50">
                <span className="text-xl" aria-hidden="true">
                  👋
                </span>
                Sign out
              </button>
            </form>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-slate-500 sm:px-6" role="status">
      Loading…
    </div>
  );
}

