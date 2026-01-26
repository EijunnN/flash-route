CREATE TABLE "vehicle_skill_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vehicle_skill_assignments" ADD CONSTRAINT "vehicle_skill_assignments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_skill_assignments" ADD CONSTRAINT "vehicle_skill_assignments_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_skill_assignments" ADD CONSTRAINT "vehicle_skill_assignments_skill_id_vehicle_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."vehicle_skills"("id") ON DELETE cascade ON UPDATE no action;