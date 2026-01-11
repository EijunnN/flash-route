CREATE TABLE "csv_column_mapping_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"column_mapping" text NOT NULL,
	"required_fields" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "optimization_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"depot_latitude" varchar(20) NOT NULL,
	"depot_longitude" varchar(20) NOT NULL,
	"depot_address" text,
	"selected_vehicle_ids" text NOT NULL,
	"selected_driver_ids" text NOT NULL,
	"objective" varchar(20) DEFAULT 'BALANCED' NOT NULL,
	"capacity_enabled" boolean DEFAULT true NOT NULL,
	"work_window_start" time NOT NULL,
	"work_window_end" time NOT NULL,
	"service_time_minutes" integer DEFAULT 10 NOT NULL,
	"time_window_strictness" varchar(20) DEFAULT 'SOFT' NOT NULL,
	"penalty_factor" integer DEFAULT 3 NOT NULL,
	"max_routes" integer,
	"status" varchar(50) DEFAULT 'DRAFT' NOT NULL,
	"confirmed_at" timestamp,
	"confirmed_by" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "optimization_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"configuration_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"result" text,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"cancelled_at" timestamp,
	"timeout_ms" integer DEFAULT 300000 NOT NULL,
	"input_hash" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"tracking_id" varchar(50) NOT NULL,
	"customer_name" varchar(255),
	"customer_phone" varchar(50),
	"customer_email" varchar(255),
	"address" text NOT NULL,
	"latitude" varchar(20) NOT NULL,
	"longitude" varchar(20) NOT NULL,
	"time_window_preset_id" uuid,
	"strictness" varchar(20),
	"promised_date" timestamp,
	"weight_required" integer,
	"volume_required" integer,
	"required_skills" text,
	"notes" text,
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_window_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(20) NOT NULL,
	"start_time" time,
	"end_time" time,
	"exact_time" time,
	"tolerance_minutes" integer,
	"strictness" varchar(20) DEFAULT 'HARD' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "csv_column_mapping_templates" ADD CONSTRAINT "csv_column_mapping_templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "optimization_configurations" ADD CONSTRAINT "optimization_configurations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "optimization_configurations" ADD CONSTRAINT "optimization_configurations_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "optimization_jobs" ADD CONSTRAINT "optimization_jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "optimization_jobs" ADD CONSTRAINT "optimization_jobs_configuration_id_optimization_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "public"."optimization_configurations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_time_window_preset_id_time_window_presets_id_fk" FOREIGN KEY ("time_window_preset_id") REFERENCES "public"."time_window_presets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_window_presets" ADD CONSTRAINT "time_window_presets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;