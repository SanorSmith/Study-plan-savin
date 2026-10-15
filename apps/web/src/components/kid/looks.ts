import type { AgeBand } from "@/lib/age-band";

/**
 * The look and the words of the kid's app for each age band. Everything is bright and colorful, with as little
 * text as possible: explanations hide behind a tap. Little kids get big colorful buttons and emoji; teens get
 * something cleaner, with no emoji, but still light and colorful (no dark mode).
 */
export type Look = {
  page: string;
  card: string;
  hero: string; // the big colored card with the time ring
  heading: string;
  pill: string; // small label, such as the subject
  question: string;
  primary: string;
  secondary: string;
  option: (index: number) => string;
  gaugeStroke: string;
  gaugeTrack: string;
  dot: string; // a filled PIN dot
  progressFill: string;
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

const MIDDLE_OPTIONS = [
  "bg-sky-100 text-sky-900 ring-sky-300",
  "bg-pink-100 text-pink-900 ring-pink-300",
  "bg-lime-100 text-lime-900 ring-lime-300",
  "bg-amber-100 text-amber-900 ring-amber-300",
];

const TEEN_ACCENTS = ["border-violet-500", "border-fuchsia-500", "border-orange-400", "border-teal-500"];

export const LOOKS: Record<AgeBand, Look> = {
  little: {
    page: "bg-gradient-to-b from-amber-200 via-pink-100 to-sky-200 text-slate-900",
    card: "rounded-[2rem] bg-white p-6 shadow-lg ring-4 ring-white/80",
    hero: "rounded-[2.5rem] bg-gradient-to-br from-fuchsia-500 via-violet-500 to-sky-500 p-6 text-white shadow-xl ring-4 ring-white/70",
    heading: "text-4xl font-black text-violet-700",
    pill: "rounded-full bg-violet-100 px-4 py-1.5 text-base font-extrabold text-violet-700",
    question: "text-3xl font-bold leading-snug",
    primary: "rounded-2xl bg-gradient-to-r from-orange-400 to-pink-500 px-6 py-4 text-2xl font-extrabold text-white shadow-md active:scale-95 disabled:opacity-50",
    secondary: "rounded-2xl bg-white px-6 py-4 text-xl font-bold text-violet-700 ring-4 ring-violet-200 active:scale-95 disabled:opacity-50",
    option: (i) => `${LITTLE_OPTIONS[i % LITTLE_OPTIONS.length]} w-full rounded-2xl px-5 py-5 text-left text-2xl font-extrabold shadow-md active:scale-95 disabled:opacity-50`,
    gaugeStroke: "stroke-white",
    gaugeTrack: "stroke-white/30",
    dot: "bg-violet-600",
    progressFill: "bg-violet-500",
    keypadKey: "rounded-2xl bg-violet-100 py-4 text-3xl font-extrabold text-violet-800 active:scale-95 active:bg-violet-200",
    emoji: true,
    bigKeypad: true,
  },
  middle: {
    page: "bg-gradient-to-b from-cyan-100 via-sky-50 to-fuchsia-100 text-slate-900",
    card: "rounded-3xl bg-white p-5 shadow-md ring-1 ring-black/5",
    hero: "rounded-3xl bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 p-6 text-white shadow-lg",
    heading: "text-3xl font-extrabold text-indigo-700",
    pill: "rounded-full bg-indigo-100 px-3 py-1 text-sm font-bold text-indigo-700",
    question: "text-2xl font-semibold leading-snug",
    primary: "rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-500 px-5 py-3 text-lg font-bold text-white shadow active:scale-95 disabled:opacity-50",
    secondary: "rounded-2xl bg-white px-5 py-3 text-lg font-semibold text-indigo-700 ring-2 ring-indigo-200 active:scale-95 disabled:opacity-50",
    option: (i) => `${MIDDLE_OPTIONS[i % MIDDLE_OPTIONS.length]} w-full rounded-2xl px-4 py-3.5 text-left text-lg font-bold ring-2 active:scale-95 disabled:opacity-50`,
    gaugeStroke: "stroke-white",
    gaugeTrack: "stroke-white/30",
    dot: "bg-indigo-600",
    progressFill: "bg-gradient-to-r from-indigo-500 to-cyan-400",
    keypadKey: "rounded-2xl bg-white py-3 text-2xl font-bold text-indigo-800 shadow-sm ring-1 ring-black/5 active:bg-indigo-100",
    emoji: true,
    bigKeypad: false,
  },
  teen: {
    page: "bg-gradient-to-br from-violet-100 via-white to-teal-100 text-slate-900",
    card: "rounded-2xl bg-white p-5 shadow-md ring-1 ring-black/5",
    hero: "rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-orange-500 p-6 text-white shadow-lg",
    heading: "text-2xl font-bold tracking-tight text-slate-900",
    pill: "rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700",
    question: "text-xl font-medium leading-snug",
    primary: "rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 text-base font-semibold text-white shadow active:scale-95 disabled:opacity-50",
    secondary: "rounded-xl bg-white px-5 py-3 text-base font-semibold text-violet-700 ring-2 ring-violet-200 active:scale-95 disabled:opacity-50",
    option: (i) => `w-full rounded-xl border-l-8 ${TEEN_ACCENTS[i % TEEN_ACCENTS.length]} bg-white px-4 py-3 text-left text-base font-medium shadow-sm ring-1 ring-black/5 active:scale-95 disabled:opacity-50`,
    gaugeStroke: "stroke-white",
    gaugeTrack: "stroke-white/30",
    dot: "bg-violet-600",
    progressFill: "bg-gradient-to-r from-violet-500 to-fuchsia-500",
    keypadKey: "rounded-xl bg-white py-3 text-xl font-semibold shadow-sm ring-1 ring-black/5 active:bg-violet-100",
    emoji: false,
    bigKeypad: false,
  },
};

export type Copy = {
  hi: (name: string) => string;
  minutes: string;
  info: string; // the one explanation, shown only when the kid taps the info button
  allDone: string;
  noHomework: string;
  correct: (minutes: number) => string;
  correctNoMinutes: string;
  tryAgain: (left: number) => string;
  wrongFinal: string;
  answer: string;
  locked: (until: string) => string;
  free: (until: string) => string;
  pairTitle: string;
  pairHint: string;
  pinTitle: string;
};

export const COPY: Record<AgeBand, Copy> = {
  little: {
    hi: (n) => `Hi ${n}! 👋`,
    minutes: "minutes",
    info: "Your play time counts down while you use other apps. Answer questions to get more! ⭐",
    allDone: "All done! 🎉",
    noHomework: "No homework. Time to play! 🎈",
    correct: (m) => `Yay! 🎉${m > 0 ? ` +${m}` : ""}`,
    correctNoMinutes: "Yay! 🎉 That's all for today!",
    tryAgain: (n) => `Oops! Try again 💪 ${"❤️".repeat(Math.max(0, Math.min(n, 3)))}`,
    wrongFinal: "Next one! 🌈",
    answer: "Done ✅",
    locked: (u) => `🌙 Back at ${u}`,
    free: (u) => `🎈 Free play until ${u}`,
    pairTitle: "Let's connect! 🔗",
    pairHint: "Ask a grown-up for the code",
    pinTitle: "Secret number 🔒",
  },
  middle: {
    hi: (n) => `Hi ${n}`,
    minutes: "min",
    info: "Minutes are used while you use other apps. Answer questions to earn more.",
    allDone: "All done! ⭐",
    noHomework: "No homework right now",
    correct: (m) => `Correct!${m > 0 ? ` +${m}` : ""}`,
    correctNoMinutes: "Correct! Daily limit reached",
    tryAgain: (n) => `Not quite. ${n} ${n === 1 ? "try" : "tries"} left`,
    wrongFinal: "Not this time",
    answer: "Answer",
    locked: (u) => `Locked until ${u}`,
    free: (u) => `Free time until ${u}`,
    pairTitle: "Connect",
    pairHint: "Ask a parent for the code",
    pinTitle: "Your PIN",
  },
  teen: {
    hi: (n) => n,
    minutes: "min",
    info: "Minutes are used while the screen is on and another app is open. Answer questions to earn more.",
    allDone: "All done",
    noHomework: "No homework",
    correct: (m) => `Correct${m > 0 ? ` +${m} min` : ""}`,
    correctNoMinutes: "Correct. Daily limit reached",
    tryAgain: (n) => `Incorrect. ${n} left`,
    wrongFinal: "Incorrect",
    answer: "Submit",
    locked: (u) => `Locked until ${u}`,
    free: (u) => `Free until ${u}`,
    pairTitle: "Connect",
    pairHint: "Code from your parent",
    pinTitle: "PIN",
  },
};
