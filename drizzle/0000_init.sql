CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"actor_label" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"description_en" text NOT NULL,
	"description_ar" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" text NOT NULL,
	"permission_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"description" text,
	"system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" text NOT NULL,
	"role_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"locale" text DEFAULT 'ar' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" text PRIMARY KEY NOT NULL,
	"faculty_id" text NOT NULL,
	"code" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faculties" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_cards" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"uid_hash" text NOT NULL,
	"uid_last4" text NOT NULL,
	"label" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" text PRIMARY KEY NOT NULL,
	"university_id" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"first_name_en" text NOT NULL,
	"first_name_ar" text NOT NULL,
	"email" text,
	"faculty_id" text,
	"department_id" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus_buildings" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus_floors" (
	"id" text PRIMARY KEY NOT NULL,
	"building_id" text NOT NULL,
	"label_en" text NOT NULL,
	"label_ar" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus_locations" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"description_en" text,
	"description_ar" text,
	"building_id" text,
	"floor_id" text,
	"room" text,
	"latitude" double precision,
	"longitude" double precision,
	"image_url" text,
	"accessibility_notes" text,
	"directions_en" text,
	"directions_ar" text,
	"published" boolean DEFAULT false NOT NULL,
	"navigable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_articles" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"tags" text[],
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"source_document" text,
	"author_id" text,
	"review_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "navigation_destinations" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"location_id" text,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"requires_confirmation" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "navigation_routes" (
	"id" text PRIMARY KEY NOT NULL,
	"destination_id" text NOT NULL,
	"mode" text DEFAULT 'PREDEFINED' NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"secret_encrypted" text NOT NULL,
	"secret_fingerprint" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"rotated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_events" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" text,
	"simulated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "robot_commands" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"priority" text DEFAULT 'NORMAL' NOT NULL,
	"issued_by_user_id" text,
	"issued_by_service" text,
	"confirmation_token" text,
	"failure_reason" text,
	"dedupe_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"acked_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "robot_devices" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"display_name" text NOT NULL,
	"location_id" text,
	"status" text DEFAULT 'OFFLINE' NOT NULL,
	"mode" text DEFAULT 'ASSISTANT' NOT NULL,
	"firmware_version" text,
	"battery_percent" integer,
	"current_destination_id" text,
	"simulated" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"terminal_token" text,
	"last_seen_at" timestamp with time zone,
	"max_speed_percent" integer DEFAULT 60 NOT NULL,
	"safety_timeout_seconds" integer DEFAULT 10 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "robot_devices_device_id_unique" UNIQUE("device_id"),
	CONSTRAINT "robot_devices_terminal_token_unique" UNIQUE("terminal_token")
);
--> statement-breakpoint
CREATE TABLE "robot_telemetry" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"battery_percent" integer,
	"speed_percent" integer,
	"obstacle_distance_cm" integer,
	"mode" text,
	"simulated" boolean DEFAULT false NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"intent" text,
	"origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"guest_id" text,
	"student_id" text,
	"user_id" text,
	"language" text DEFAULT 'ar' NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"url" text NOT NULL,
	"secure_url" text,
	"format" text,
	"bytes" integer,
	"width" integer,
	"height" integer,
	"folder" text,
	"kind" text DEFAULT 'general' NOT NULL,
	"pending" boolean DEFAULT false NOT NULL,
	"uploaded_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_faculty_id_faculties_id_fk" FOREIGN KEY ("faculty_id") REFERENCES "public"."faculties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_cards" ADD CONSTRAINT "student_cards_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_faculty_id_faculties_id_fk" FOREIGN KEY ("faculty_id") REFERENCES "public"."faculties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_floors" ADD CONSTRAINT "campus_floors_building_id_campus_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."campus_buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_locations" ADD CONSTRAINT "campus_locations_building_id_campus_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."campus_buildings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_locations" ADD CONSTRAINT "campus_locations_floor_id_campus_floors_id_fk" FOREIGN KEY ("floor_id") REFERENCES "public"."campus_floors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_category_id_knowledge_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."knowledge_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigation_destinations" ADD CONSTRAINT "navigation_destinations_location_id_campus_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."campus_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigation_routes" ADD CONSTRAINT "navigation_routes_destination_id_navigation_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."navigation_destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_credentials" ADD CONSTRAINT "device_credentials_device_id_robot_devices_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."robot_devices"("device_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_device_id_robot_devices_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."robot_devices"("device_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "robot_commands" ADD CONSTRAINT "robot_commands_device_id_robot_devices_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."robot_devices"("device_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "robot_commands" ADD CONSTRAINT "robot_commands_issued_by_user_id_users_id_fk" FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "robot_devices" ADD CONSTRAINT "robot_devices_location_id_campus_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."campus_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "robot_devices" ADD CONSTRAINT "robot_devices_current_destination_id_navigation_destinations_id_fk" FOREIGN KEY ("current_destination_id") REFERENCES "public"."navigation_destinations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "robot_telemetry" ADD CONSTRAINT "robot_telemetry_device_id_robot_devices_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."robot_devices"("device_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_settings" ADD CONSTRAINT "application_settings_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reset_tokens_hash_unique" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "reset_tokens_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_key_unique" ON "permissions" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_unique" ON "role_permissions" USING btree ("role_id","permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_key_unique" ON "roles" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expiry_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_unique" ON "user_roles" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_active_idx" ON "users" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_code_unique" ON "departments" USING btree ("code");--> statement-breakpoint
CREATE INDEX "departments_faculty_idx" ON "departments" USING btree ("faculty_id");--> statement-breakpoint
CREATE UNIQUE INDEX "faculties_code_unique" ON "faculties" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "student_cards_uid_hash_unique" ON "student_cards" USING btree ("uid_hash");--> statement-breakpoint
CREATE INDEX "student_cards_student_idx" ON "student_cards" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_cards_status_idx" ON "student_cards" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "students_university_id_unique" ON "students" USING btree ("university_id");--> statement-breakpoint
CREATE INDEX "students_status_idx" ON "students" USING btree ("status");--> statement-breakpoint
CREATE INDEX "students_faculty_idx" ON "students" USING btree ("faculty_id");--> statement-breakpoint
CREATE INDEX "students_department_idx" ON "students" USING btree ("department_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campus_buildings_code_unique" ON "campus_buildings" USING btree ("code");--> statement-breakpoint
CREATE INDEX "campus_floors_building_idx" ON "campus_floors" USING btree ("building_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campus_locations_key_unique" ON "campus_locations" USING btree ("key");--> statement-breakpoint
CREATE INDEX "campus_locations_published_idx" ON "campus_locations" USING btree ("published");--> statement-breakpoint
CREATE INDEX "campus_locations_building_idx" ON "campus_locations" USING btree ("building_id");--> statement-breakpoint
CREATE INDEX "knowledge_articles_status_idx" ON "knowledge_articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "knowledge_articles_category_idx" ON "knowledge_articles" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_categories_key_unique" ON "knowledge_categories" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "navigation_destinations_key_unique" ON "navigation_destinations" USING btree ("key");--> statement-breakpoint
CREATE INDEX "navigation_destinations_active_idx" ON "navigation_destinations" USING btree ("active");--> statement-breakpoint
CREATE INDEX "navigation_routes_destination_idx" ON "navigation_routes" USING btree ("destination_id");--> statement-breakpoint
CREATE UNIQUE INDEX "device_credentials_device_unique" ON "device_credentials" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "device_events_device_time_idx" ON "device_events" USING btree ("device_id","created_at");--> statement-breakpoint
CREATE INDEX "device_events_type_idx" ON "device_events" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "device_events_dedupe_unique" ON "device_events" USING btree ("device_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "robot_commands_device_status_idx" ON "robot_commands" USING btree ("device_id","status");--> statement-breakpoint
CREATE INDEX "robot_commands_status_created_idx" ON "robot_commands" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "robot_commands_expiry_idx" ON "robot_commands" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "robot_commands_dedupe_unique" ON "robot_commands" USING btree ("device_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "robot_devices_status_idx" ON "robot_devices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "robot_devices_active_idx" ON "robot_devices" USING btree ("active");--> statement-breakpoint
CREATE INDEX "robot_telemetry_device_time_idx" ON "robot_telemetry" USING btree ("device_id","recorded_at");--> statement-breakpoint
CREATE INDEX "conversation_messages_conversation_idx" ON "conversation_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "conversation_messages_created_idx" ON "conversation_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "conversations_student_idx" ON "conversations" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "conversations_created_idx" ON "conversations" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_public_id_unique" ON "media_assets" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "media_assets_kind_idx" ON "media_assets" USING btree ("kind");