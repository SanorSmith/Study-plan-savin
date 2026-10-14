CREATE TABLE "paper_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"content_type" text NOT NULL,
	"data_base64" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kids" ADD COLUMN "ai_check_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "paper_submissions" ADD COLUMN "mode" text DEFAULT 'parent' NOT NULL;--> statement-breakpoint
ALTER TABLE "paper_submissions" ADD COLUMN "ai_read" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "paper_submissions" ADD COLUMN "auto_approved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "paper_submissions" ADD COLUMN "awarded_minutes" integer;--> statement-breakpoint
ALTER TABLE "paper_images" ADD CONSTRAINT "paper_images_submission_id_paper_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."paper_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "paper_images_one_per_position" ON "paper_images" USING btree ("submission_id","position");