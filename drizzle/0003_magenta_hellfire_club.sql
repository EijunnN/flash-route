CREATE TABLE "output_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"generated_by" uuid NOT NULL,
	"format" varchar(10) DEFAULT 'JSON' NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"file_url" text,
	"error" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"configuration_id" uuid NOT NULL,
	"total_routes" integer NOT NULL,
	"total_stops" integer NOT NULL,
	"total_distance" integer NOT NULL,
	"total_duration" integer NOT NULL,
	"average_utilization_rate" integer NOT NULL,
	"max_utilization_rate" integer NOT NULL,
	"min_utilization_rate" integer NOT NULL,
	"time_window_compliance_rate" integer NOT NULL,
	"total_time_window_violations" integer NOT NULL,
	"driver_assignment_coverage" integer NOT NULL,
	"average_assignment_quality" integer NOT NULL,
	"assignments_with_warnings" integer NOT NULL,
	"assignments_with_errors" integer NOT NULL,
	"skill_coverage" integer NOT NULL,
	"license_compliance" integer NOT NULL,
	"fleet_alignment" integer NOT NULL,
	"workload_balance" integer NOT NULL,
	"unassigned_orders" integer NOT NULL,
	"objective" varchar(20),
	"processing_time_ms" integer NOT NULL,
	"compared_to_job_id" uuid,
	"distance_change_percent" integer,
	"duration_change_percent" integer,
	"compliance_change_percent" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reassignments_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"job_id" uuid,
	"absent_driver_id" uuid NOT NULL,
	"absent_driver_name" varchar(255) NOT NULL,
	"route_ids" text NOT NULL,
	"vehicle_ids" text NOT NULL,
	"reassignments" text NOT NULL,
	"reason" text,
	"executed_by" uuid,
	"executed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_stop_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"route_stop_id" uuid NOT NULL,
	"previous_status" varchar(20),
	"new_status" varchar(20) NOT NULL,
	"user_id" uuid,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_stops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"route_id" varchar(100) NOT NULL,
	"driver_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"address" text NOT NULL,
	"latitude" varchar(20) NOT NULL,
	"longitude" varchar(20) NOT NULL,
	"estimated_arrival" timestamp,
	"estimated_service_time" integer,
	"time_window_start" timestamp,
	"time_window_end" timestamp,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "output_history" ADD CONSTRAINT "output_history_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "output_history" ADD CONSTRAINT "output_history_job_id_optimization_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."optimization_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "output_history" ADD CONSTRAINT "output_history_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_metrics" ADD CONSTRAINT "plan_metrics_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_metrics" ADD CONSTRAINT "plan_metrics_job_id_optimization_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."optimization_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_metrics" ADD CONSTRAINT "plan_metrics_configuration_id_optimization_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "public"."optimization_configurations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_metrics" ADD CONSTRAINT "plan_metrics_compared_to_job_id_optimization_jobs_id_fk" FOREIGN KEY ("compared_to_job_id") REFERENCES "public"."optimization_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reassignments_history" ADD CONSTRAINT "reassignments_history_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reassignments_history" ADD CONSTRAINT "reassignments_history_job_id_optimization_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."optimization_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reassignments_history" ADD CONSTRAINT "reassignments_history_absent_driver_id_drivers_id_fk" FOREIGN KEY ("absent_driver_id") REFERENCES "public"."drivers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reassignments_history" ADD CONSTRAINT "reassignments_history_executed_by_users_id_fk" FOREIGN KEY ("executed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stop_history" ADD CONSTRAINT "route_stop_history_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stop_history" ADD CONSTRAINT "route_stop_history_route_stop_id_route_stops_id_fk" FOREIGN KEY ("route_stop_id") REFERENCES "public"."route_stops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stop_history" ADD CONSTRAINT "route_stop_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_job_id_optimization_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."optimization_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;