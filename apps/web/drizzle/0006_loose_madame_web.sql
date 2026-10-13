ALTER TABLE "kids" ADD COLUMN "settings_approved_until" timestamp;--> statement-breakpoint
ALTER TABLE "parents" ADD COLUMN "approval_pin_hash" text;--> statement-breakpoint
ALTER TABLE "parents" ADD COLUMN "approval_failed_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "parents" ADD COLUMN "approval_locked_until" timestamp;