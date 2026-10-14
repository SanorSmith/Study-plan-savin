CREATE TABLE "paper_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"read_answer" text,
	"legible" boolean NOT NULL,
	"ai_correct" boolean NOT NULL,
	"final_correct" boolean,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "paper_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kid_id" uuid NOT NULL,
	"set_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"submitted_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "paper_answers" ADD CONSTRAINT "paper_answers_submission_id_paper_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."paper_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_answers" ADD CONSTRAINT "paper_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_submissions" ADD CONSTRAINT "paper_submissions_kid_id_kids_id_fk" FOREIGN KEY ("kid_id") REFERENCES "public"."kids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_submissions" ADD CONSTRAINT "paper_submissions_set_id_homework_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."homework_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "paper_answers_one_per_question" ON "paper_answers" USING btree ("submission_id","question_id");