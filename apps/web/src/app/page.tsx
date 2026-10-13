import Link from "next/link";
import { btn } from "@/components/ui";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-4 py-10">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight">Study Plan</h1>
        <p className="mt-3 text-lg text-slate-600">Homework first, screen time after. Kids earn minutes by answering homework correctly.</p>
      </div>
      <div className="space-y-3">
        <Link href="/dashboard" className={`${btn.primary} w-full py-3 text-base`}>
          I&apos;m a parent
        </Link>
        <Link href="/kid" className={`${btn.secondary} w-full py-3 text-base`}>
          I&apos;m a kid
        </Link>
      </div>
    </main>
  );
}
