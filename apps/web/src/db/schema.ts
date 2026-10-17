import { sql } from "drizzle-orm";
import {
  boolean,
  jsonb,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const parents = pgTable("parents", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Id of the signed-in user in Neon Auth; set on first login.
  authUserId: text("auth_user_id").notNull().unique(),
  email: text("email"),
  // 6-digit PIN a parent types on a kid's phone to open Settings and uninstall screens.
  approvalPinHash: text("approval_pin_hash"),
  approvalFailedAttempts: integer("approval_failed_attempts").notNull().default(0),
  approvalLockedUntil: timestamp("approval_locked_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const kids = pgTable("kids", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentId: uuid("parent_id")
    .notNull()
    .references(() => parents.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  grade: integer("grade").notNull(),
  minutesPerQuestion: integer("minutes_per_question").notNull().default(10),
  dailyCapMinutes: integer("daily_cap_minutes").notNull().default(120),
  pinHash: text("pin_hash"),
  pinFailedAttempts: integer("pin_failed_attempts").notNull().default(0),
  pinLockedUntil: timestamp("pin_locked_until"),
  // While in the future, the kid's phone allows Settings and uninstall screens (a parent approved it).
  settingsApprovedUntil: timestamp("settings_approved_until"),
  // When on, the kid may choose AI checking for a paper and the minutes are added straight away.
  aiCheckEnabled: boolean("ai_check_enabled").notNull().default(false),
  // The look of the kid's app: auto (from the grade), little, middle or teen.
  uiStyle: text("ui_style").notNull().default("auto"),
  // AI practice questions sent between the daily homework: off, daily, every_other_day or weekly.
  autoPractice: text("auto_practice").notNull().default("off"),
  autoPracticeSize: integer("auto_practice_size").notNull().default(5),
  lastPracticeAt: timestamp("last_practice_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  kidId: uuid("kid_id")
    .notNull()
    .references(() => kids.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(), // android | ios | web
  pairingCode: text("pairing_code").unique(),
  pairingExpiresAt: timestamp("pairing_expires_at"),
  // sha256 of the device token; the raw token is shown to the device once.
  tokenHash: text("token_hash").unique(),
  // Set when the kid enters the right PIN on this device; the kid view needs it.
  unlockedUntil: timestamp("unlocked_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const homeworkSets = pgTable("homework_sets", {
  id: uuid("id").primaryKey().defaultRandom(),
  kidId: uuid("kid_id")
    .notNull()
    .references(() => kids.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("draft"), // draft | assigned
  kind: text("kind").notNull().default("homework"), // homework | practice (AI made, similar to what the kid got wrong)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  setId: uuid("set_id")
    .notNull()
    .references(() => homeworkSets.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  type: text("type").notNull(), // multiple_choice | numeric | short_text
  options: text("options").array(),
  answerKey: text("answer_key").notNull(),
  confirmed: boolean("confirmed").notNull().default(false),
  position: integer("position").notNull().default(0),
  // The number printed next to the question on the worksheet (3, 4b, Exercise 2). The app keeps its own order in `position`.
  label: text("label"),
});

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    kidId: uuid("kid_id")
      .notNull()
      .references(() => kids.id, { onDelete: "cascade" }),
    answer: text("answer").notNull(),
    correct: boolean("correct").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("attempts_by_question_kid").on(t.questionId, t.kidId)],
);

// Positive delta = earned, negative = spent.
export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kidId: uuid("kid_id")
      .notNull()
      .references(() => kids.id, { onDelete: "cascade" }),
    deltaMinutes: integer("delta_minutes").notNull(),
    reason: text("reason").notNull(), // correct_answer | usage | bonus | adjustment
    questionId: uuid("question_id").references(() => questions.id),
    // Lets a client safely retry a usage report without being charged twice.
    idempotencyKey: text("idempotency_key").unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    // A question can only earn minutes once per kid.
    uniqueIndex("credit_ledger_one_earn_per_question")
      .on(t.kidId, t.questionId)
      .where(sql`${t.reason} = 'correct_answer'`),
  ],
);

export const screenSessions = pgTable("screen_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  kidId: uuid("kid_id")
    .notNull()
    .references(() => kids.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").references(() => devices.id),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endsAt: timestamp("ends_at").notNull(),
});

// Fixed-window request counters, keyed like "pair:<ip>".
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start").notNull().defaultNow(),
  count: integer("count").notNull().default(0),
});

// When a kid's phone is locked ("blocked") or free to use without credit ("free").
// `days` is a bitmask (Monday = 1 ... Sunday = 64); times are minutes after midnight.
// An end before the start means the window runs past midnight.
export const scheduleRules = pgTable("schedule_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  kidId: uuid("kid_id")
    .notNull()
    .references(() => kids.id, { onDelete: "cascade" }),
  mode: text("mode").notNull(), // blocked | free
  days: integer("days").notNull(),
  startMinute: integer("start_minute").notNull(),
  endMinute: integer("end_minute").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A photo of a finished paper, read by the AI and waiting for a parent to confirm before minutes are awarded.
// The photos are kept for a short while so a parent can look at them (see paper_images).
export const paperSubmissions = pgTable("paper_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  kidId: uuid("kid_id")
    .notNull()
    .references(() => kids.id, { onDelete: "cascade" }),
  setId: uuid("set_id")
    .notNull()
    .references(() => homeworkSets.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  submittedBy: text("submitted_by").notNull(), // kid | parent
  mode: text("mode").notNull().default("parent"), // ai (checked by AI, credited at once) | parent (a parent checks)
  aiRead: boolean("ai_read").notNull().default(false), // true once the AI has read the photos
  autoApproved: boolean("auto_approved").notNull().default(false),
  awardedMinutes: integer("awarded_minutes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export const paperAnswers = pgTable(
  "paper_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => paperSubmissions.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    readAnswer: text("read_answer"), // what the AI read from the paper; null if nothing legible
    legible: boolean("legible").notNull(),
    aiCorrect: boolean("ai_correct").notNull(), // the suggestion
    finalCorrect: boolean("final_correct"), // the parent's decision, set on approval
    note: text("note"),
  },
  (t) => [uniqueIndex("paper_answers_one_per_question").on(t.submissionId, t.questionId)],
);

// The photos of a paper, so a parent can see what was sent. Kept as base64 text and deleted after 14 days.
export const paperImages = pgTable(
  "paper_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => paperSubmissions.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    contentType: text("content_type").notNull(),
    dataBase64: text("data_base64").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("paper_images_one_per_position").on(t.submissionId, t.position)],
);

/** A phone running the Study Plan parent app. Paired with a short code made on the website, then holds a token. */
export const parentDevices = pgTable("parent_devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentId: uuid("parent_id")
    .notNull()
    .references(() => parents.id, { onDelete: "cascade" }),
  name: text("name"),
  pairingCode: text("pairing_code").unique(),
  pairingExpiresAt: timestamp("pairing_expires_at"),
  // sha256 of the token; the raw token is shown to the phone once.
  tokenHash: text("token_hash").unique(),
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** A message from a parent to a kid: the result of a checked paper, a note, or new practice questions. The kid sees it until they dismiss it. */
export const kidMessages = pgTable(
  "kid_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kidId: uuid("kid_id")
      .notNull()
      .references(() => kids.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // result | note | practice
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    readAt: timestamp("read_at"),
  },
  (t) => [index("kid_messages_by_kid").on(t.kidId, t.createdAt)],
);

/** A browser or installed web app that wants a notification when a kid sends a paper (Web Push). */
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentId: uuid("parent_id")
    .notNull()
    .references(() => parents.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Secrets the app makes for itself (the Web Push signing keys), so nothing has to be set by hand. */
export const appSecrets = pgTable("app_secrets", {
  name: text("name").primaryKey(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** An AI assessment of how a kid is doing over a week, a month or a year, kept so the parent can look back. */
export const performanceReports = pgTable(
  "performance_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kidId: uuid("kid_id")
      .notNull()
      .references(() => kids.id, { onDelete: "cascade" }),
    period: text("period").notNull(), // week | month | year
    rangeStart: timestamp("range_start").notNull(),
    rangeEnd: timestamp("range_end").notNull(),
    stats: jsonb("stats").notNull(),
    assessment: jsonb("assessment"), // the AI's reading; null if the AI was not asked
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("performance_reports_by_kid").on(t.kidId, t.createdAt)],
);
