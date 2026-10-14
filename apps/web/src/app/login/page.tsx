import { Suspense } from "react";
import Link from "next/link";
import { btn, Card } from "@/components/ui";
import { LoginForm } from "./LoginForm";

async function Content({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const { reset } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <Link href="/" className={`${btn.link} mb-6 no-underline`}>
        ← Study Plan
      </Link>
      <Card>
        <h1 className="mb-5 text-2xl font-semibold tracking-tight">Parent sign in</h1>
        {reset === "1" && (
          <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
            Your password was changed. Sign in with the new one.
          </p>
        )}
        <LoginForm />
      </Card>
    </main>
  );
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  return (
    <Suspense fallback={<main className="p-6 text-sm text-slate-500">Loading…</main>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
