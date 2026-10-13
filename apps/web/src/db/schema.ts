import { sql } from "drizzle-orm";
import {
  boolean,
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
