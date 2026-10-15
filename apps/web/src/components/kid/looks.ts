import type { AgeBand } from "@/lib/age-band";

/** The look and the words of the kid's app for each age band. Little kids get big colorful buttons and emoji; teens get something clean. */
export type Look = {
  page: string;
  card: string;
  heading: string;
  label: string;
  question: string;
  primary: string;
  secondary: string;
  option: (index: number) => string;
  gaugeStroke: string;
  gaugeTrack: string;
  keypadKey: string;
  emoji: boolean;
  bigKeypad: boolean; // numeric answers use an on-screen number pad
};

const LITTLE_OPTIONS = [
  "bg-rose-500 text-white",
  "bg-sky-500 text-white",
  "bg-emerald-500 text-white",
  "bg-amber-400 text-slate-900",
];

export const LOOKS: Record<AgeBand, Look> = {
  little: {
    page: "bg-gradient-to-b from-amber-100 via-pink-50 to-sky-100 text-slate-900",
    card: "rounded-[2rem] bg-white p-6 shadow-lg ring-4 ring-white/80",
    heading: "text-4xl font-black text-violet-700",
    label: "text-base font-bold text-violet-600",
    question: "text-3xl font-bold leading-snug",
    primary: "rounded-2xl bg-violet-600 px-6 py-4 text-2xl font-extrabold text-white shadow-md active:scale-95 disabled:opacity-50",
    secondary: "rounded-2xl bg-white px-6 py-4 text-xl font-bold text-violet-700 ring-4 ring-violet-200 active:scale-95 disabled:opacity-50",
    option: (i) => `${LITTLE_OPTIONS[i % LITTLE_OPTIONS.length]} w-full rounded-2xl px-5 py-5 text-left text-2xl font-extrabold shadow-md active:scale-95 disabled:opacity-50`,
    gaugeStroke: "stroke-violet-500",
    gaugeTrack: "stroke-violet-100",
    keypadKey: "rounded-2xl bg-violet-100 py-4 text-3xl font-extrabold text-violet-800 active:scale-95 active:bg-violet-200",
    emoji: true,
    bigKeypad: true,
  },
  middle: {
    page: "bg-gradient-to-b from-sky-50 to-indigo-50 text-slate-900",
    card: "rounded-2xl bg-white p-5 shadow-md",
    heading: "text-3xl font-extrabold text-indigo-700",
    label: "text-sm font-semibold text-indigo-600",
    question: "text-2xl font-semibold leading-snug",
    primary: "rounded-xl bg-indigo-600 px-5 py-3 text-lg font-bold text-white shadow active:scale-95 disabled:opacity-50",
    secondary: "rounded-xl border-2 border-indigo-200 bg-white px-5 py-3 text-lg font-semibold text-indigo-700 active:scale-95 disabled:opacity-50",
    option: () => "w-full rounded-xl border-2 border-indigo-200 bg-white px-4 py-3 text-left text-lg font-semibold hover:bg-indigo-50 active:scale-95 disabled:opacity-50",
    gaugeStroke: "stroke-indigo-500",
    gaugeTrack: "stroke-indigo-100",
    keypadKey: "rounded-xl bg-indigo-50 py-3 text-2xl font-bold text-indigo-800 active:bg-indigo-100",
    emoji: true,
    bigKeypad: false,
  },
  teen: {
    page: "bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100",
    card: "rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900",
    heading: "text-2xl font-semibold tracking-tight",
    label: "text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400",
    question: "text-xl leading-snug",
    primary: "rounded-lg bg-slate-900 px-4 py-2.5 text-base font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900",
    secondary: "rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-base font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
    option: () =>
      "w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-left text-base hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800",
    gaugeStroke: "stroke-slate-900 dark:stroke-slate-100",
    gaugeTrack: "stroke-slate-200 dark:stroke-slate-800",
    keypadKey: "rounded-lg border border-slate-300 bg-white py-3 text-xl dark:border-slate-700 dark:bg-slate-900",
    emoji: false,
    bigKeypad: false,
  },
};

export type Copy = {
  hi: (name: string) => string;
  bank: string;
  minutes: string;
  yourTurn: string;
  allDone: string;
  noHomework: string;
  correct: (minutes: number) => string;
  correctNoMinutes: string;
  tryAgain: (left: number) => string;
  wrongFinal: string;
  answer: string;
  locked: (until: string) => string;
  free: (until: string) => string;
  automatic: string;
  pairTitle: string;
  pairHint: string;
  pinTitle: string;
};

export const COPY: Record<AgeBand, Copy> = {
  little: {
    hi: (n) => `Hi ${n}! 👋`,
    bank: "Your play time",
    minutes: "minutes",
    yourTurn: "Your turn! ⭐",
    allDone: "All done! 🎉 You finished your homework!",
    noHomework: "No homework right now. Time to play! 🎈",
    correct: (m) => `Yay! You got it! 🎉 ${m > 0 ? `+${m} minutes` : ""}`.trim(),
    correctNoMinutes: "Yay! Right! 🎉 That is all the play time for today.",
    tryAgain: (n) => `Oops! Try again 💪 (${n} ${n === 1 ? "try" : "tries"} left)`,
    wrongFinal: "Not this time. On to the next one! 🌈",
    answer: "Done ✅",
    locked: (u) => `Sleepy time 🌙 Back at ${u}`,
    free: (u) => `Free play until ${u}! 🎈`,
    automatic: "Your play time counts down while you use other apps.",
    pairTitle: "Let's connect! 🔗",
    pairHint: "Ask a grown-up for the code.",
    pinTitle: "What is your secret number? 🔒",
  },
  middle: {
    hi: (n) => `Hi ${n}`,
    bank: "Screen time bank",
    minutes: "min",
    yourTurn: "Next question",
    allDone: "All done! ⭐ Nice work on your homework.",
    noHomework: "No homework waiting. Ask a parent to add some.",
    correct: (m) => `Correct! ${m > 0 ? `+${m} minutes` : ""}`.trim(),
    correctNoMinutes: "Correct! You have reached today's limit, so no more minutes today.",
    tryAgain: (n) => `Not quite. Try again (${n} ${n === 1 ? "try" : "tries"} left).`,
    wrongFinal: "Not quite. No minutes for this one.",
    answer: "Answer",
    locked: (u) => `The phone is locked until ${u}.`,
    free: (u) => `Free time until ${u}. No minutes are used.`,
    automatic: "Minutes are used automatically while you use other apps.",
    pairTitle: "Connect this device",
    pairHint: "Ask a parent for the pairing code.",
    pinTitle: "Enter your PIN",
  },
  teen: {
    hi: (n) => n,
    bank: "Screen time left",
    minutes: "min",
    yourTurn: "Question",
    allDone: "All done for now.",
    noHomework: "No homework waiting.",
    correct: (m) => `Correct${m > 0 ? `. +${m} min` : ""}`,
    correctNoMinutes: "Correct. Daily limit reached, no more minutes today.",
    tryAgain: (n) => `Incorrect. ${n} ${n === 1 ? "try" : "tries"} left.`,
    wrongFinal: "Incorrect. No minutes for this one.",
    answer: "Submit",
    locked: (u) => `Locked until ${u}.`,
    free: (u) => `Free time until ${u}. No minutes used.`,
    automatic: "Minutes are used while the screen is on and another app is open.",
    pairTitle: "Connect device",
    pairHint: "Enter the pairing code from your parent.",
    pinTitle: "Enter PIN",
  },
};
