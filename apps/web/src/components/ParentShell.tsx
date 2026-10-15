import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/login/actions";
import { btn } from "@/components/ui";

/** Header and page container for every signed-in parent page. */
export function ParentShell({ children, width = "max-w-5xl" }: { children: ReactNode; width?: string }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="text-base font-semibold tracking-tight text-slate-900">
            Study Plan
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className={btn.link}>
              Dashboard
            </Link>
            <form action={signOut}>
              <button className={btn.link}>Sign out</button>
            </form>
          </nav>
        </div>
      </header>
      <main className={`mx-auto w-full ${width} px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6`}>{children}</main>
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
