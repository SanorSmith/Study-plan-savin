CREATE TABLE "kid_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kid_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "kid_messages" ADD CONSTRAINT "kid_messages_kid_id_kids_id_fk" FOREIGN KEY ("kid_id") REFERENCES "public"."kids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kid_messages_by_kid" ON "kid_messages" USING btree ("kid_id","created_at");