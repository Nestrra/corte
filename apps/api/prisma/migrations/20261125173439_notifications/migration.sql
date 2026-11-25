-- CreateEnum
CREATE TYPE "device_platform" AS ENUM ('ios', 'android');

-- CreateEnum
CREATE TYPE "notification_kind" AS ENUM ('budget_alert', 'cutoff_reminder', 'payment_reminder', 'recurring_reminder', 'daily_digest');

-- AlterTable
ALTER TABLE "recurring_payments" ADD COLUMN     "remind_days" SMALLINT NOT NULL DEFAULT 2;

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "platform" "device_platform" NOT NULL,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL,
    "last_test_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "kind" "notification_kind" NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "body" VARCHAR(300) NOT NULL,
    "target_type" VARCHAR(16) NOT NULL,
    "target_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_dispatches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "kind" "notification_kind" NOT NULL,
    "reference_id" UUID NOT NULL,
    "reference_date" DATE NOT NULL,
    "threshold" SMALLINT,
    "notification_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tickets" (
    "id" VARCHAR(64) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "devices_token_key" ON "devices"("token");

-- CreateIndex
CREATE INDEX "devices_user_id_idx" ON "devices"("user_id");

-- CreateIndex
CREATE INDEX "devices_session_id_idx" ON "devices"("session_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notification_dispatches_created_at_idx" ON "notification_dispatches"("created_at");

-- CreateIndex
CREATE INDEX "push_tickets_created_at_idx" ON "push_tickets"("created_at");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_dispatches" ADD CONSTRAINT "notification_dispatches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_dispatches" ADD CONSTRAINT "notification_dispatches_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hand-written (spec 006 data-model.md). The key that prevents repeating a notice: threshold is
-- null except for budget_alert, so nulls must not be distinct (research.md R6).
CREATE UNIQUE INDEX "notification_dispatches_key" ON "notification_dispatches"("user_id", "kind", "reference_id", "reference_date", "threshold") NULLS NOT DISTINCT;

ALTER TABLE "notification_dispatches" ADD CONSTRAINT "notification_dispatches_threshold_check"
  CHECK (
    (kind = 'budget_alert' AND threshold IN (70, 90, 100))
    OR (kind <> 'budget_alert' AND threshold IS NULL)
  );

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_kind_check" CHECK (kind <> 'daily_digest');

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_target_type_check"
  CHECK (target_type IN ('card', 'statement', 'occurrence'));

ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_remind_days_check"
  CHECK (remind_days BETWEEN 0 AND 15);
