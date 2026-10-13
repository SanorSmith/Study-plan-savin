ALTER TABLE "devices" ADD COLUMN "unlocked_until" timestamp;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_one_earn_per_question" ON "credit_ledger" USING btree ("kid_id","question_id") WHERE "credit_ledger"."reason" = 'correct_answer';