DROP INDEX "attempts_one_per_question";--> statement-breakpoint
CREATE INDEX "attempts_by_question_kid" ON "attempts" USING btree ("question_id","kid_id");