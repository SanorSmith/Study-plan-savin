import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const parents = pgTable("parents", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  kidId: uuid("kid_id")
    .notNull()
    .references(() => kids.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(), // android | ios | web
  pairingCode: text("pairing_code").unique(),
  token: text("token").unique(),
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
});

export const attempts = pgTable("attempts", {
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
});

// Positive delta = earned, negative = spent.
export const creditLedger = pgTable("credit_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  kidId: uuid("kid_id")
    .notNull()
    .references(() => kids.id, { onDelete: "cascade" }),
  deltaMinutes: integer("delta_minutes").notNull(),
  reason: text("reason").notNull(), // correct_answer | spend | adjustment
  questionId: uuid("question_id").references(() => questions.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const screenSessions = pgTable("screen_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  kidId: uuid("kid_id")
    .notNull()
    .references(() => kids.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").references(() => devices.id),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endsAt: timestamp("ends_at").notNull(),
});
