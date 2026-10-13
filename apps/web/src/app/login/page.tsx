import Link from "next/link";
import { btn, Card } from "@/components/ui";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <Link href="/" className={`${btn.link} mb-6 no-underline`}>
        ← Study Plan
      </Link>
      <Card>
        <h1 className="mb-5 text-2xl font-semibold tracking-tight">Parent sign in</h1>
        <LoginForm />
      </Card>
    </main>
  );
}
