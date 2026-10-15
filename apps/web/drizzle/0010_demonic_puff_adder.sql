CREATE TABLE "parent_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"name" text,
	"pairing_code" text,
	"pairing_expires_at" timestamp,
	"token_hash" text,
	"last_seen_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "parent_devices_pairing_code_unique" UNIQUE("pairing_code"),
	CONSTRAINT "parent_devices_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "parent_devices" ADD CONSTRAINT "parent_devices_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;