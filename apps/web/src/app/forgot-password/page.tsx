import Link from "next/link";
import { btn, Card } from "@/components/ui";
import { ForgotForm } from "./ForgotForm";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <Link href="/login" className={`${btn.link} mb-6 no-underline`}>
        ← Back to sign in
      </Link>
      <Card>
        <h1 className="text-2xl font-semibold tracking-tight">Forgot password</h1>
        <p className="mb-5 mt-1 text-sm text-slate-600">Enter your email and we&apos;ll send you a link to choose a new password.</p>
        <ForgotForm />
      </Card>
    </main>
  );
}
