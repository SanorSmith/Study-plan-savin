import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold">Study Plan</h1>
        <p className="mt-2 text-gray-600">
          Homework first, screen time after. Kids earn minutes by answering homework questions
          correctly.
        </p>
      </div>
      <div className="space-y-3">
        <Link href="/dashboard" className="block rounded bg-black p-4 text-center text-white">
          I&apos;m a parent
        </Link>
        <Link href="/kid" className="block rounded border p-4 text-center">
          I&apos;m a kid
        </Link>
      </div>
    </main>
  );
}
