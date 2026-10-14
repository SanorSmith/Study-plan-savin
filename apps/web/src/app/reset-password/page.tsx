import { Suspense } from "react";
import Link from "next/link";
import { btn, Card } from "@/components/ui";
import { ResetForm } from "./ResetForm";

async function Content({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <Card>
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        {token ? (
          <div className="mt-5">
            <ResetForm token={token} />
          </div>
        ) : (
          <div className="mt-3 space-y-4 text-sm text-slate-600">
            <p>This link is missing its code. Open the link from the email again, or ask for a new one.</p>
            <Link href="/forgot-password" className={btn.secondary}>
              Send a new link
            </Link>
          </div>
        )}
      </Card>
    </main>
  );
}

export default function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return (
    <Suspense fallback={<main className="p-6 text-sm text-slate-500">Loading…</main>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
