"use client";

import { useState } from "react";
import { KidHome, type AnswerOutcome, type KidQuestion } from "@/components/kid/KidHome";
import type { AgeBand } from "@/lib/age-band";

const DEMO: (KidQuestion & { key: string })[] = [
  { id: "d1", text: "What is 7 × 8?", type: "numeric", options: null, subject: "Math", key: "56" },
  { id: "d2", text: "Which is a prime number?", type: "multiple_choice", options: ["9", "15", "13", "21"], subject: "Math", key: "13" },
  { id: "d3", text: "What is 144 ÷ 12?", type: "numeric", options: null, subject: "Math", key: "12" },
];

/** A working copy of the kid's home screen with made-up homework. Nothing here is saved or sent anywhere. */
export function PreviewClient({ band, name, minutesPerQuestion }: { band: AgeBand; name: string; minutesPerQuestion: number }) {
  const [index, setIndex] = useState(0);
  const [bank, setBank] = useState(34);
  const [tries, setTries] = useState(0);

  async function onAnswer(q: KidQuestion, value: string): Promise<AnswerOutcome> {
    const demo = DEMO[index];
    const correct = value.trim().replace(",", ".") === demo.key;
    if (correct) {
      setBank((b) => b + minutesPerQuestion);
      setTries(0);
      setIndex((i) => i + 1);
      return { correct: true, earnedMinutes: minutesPerQuestion, attemptsLeft: 0 };
    }
    const used = tries + 1;
    if (used >= 3) {
      setTries(0);
      setIndex((i) => i + 1);
    } else {
      setTries(used);
    }
    void q;
    return { correct: false, earnedMinutes: 0, attemptsLeft: Math.max(0, 3 - used) };
  }

  const question = index < DEMO.length ? DEMO[index] : null;
  return (
    <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[2rem] border-8 border-slate-800 shadow-2xl">
      <div className="max-h-[820px] overflow-y-auto">
        <KidHome
          state={{
            name,
            balanceMinutes: bank,
            minutesPerQuestion,
            earnableTodayMinutes: 60,
            question: question && { id: question.id, text: question.text, type: question.type, options: question.options, subject: question.subject },
            progress: question ? { done: index, total: DEMO.length } : null,
            schedule: { timezone: "UTC", rules: [] },
          }}
          band={band}
          onAnswer={onAnswer}
        />
      </div>
    </div>
  );
}
