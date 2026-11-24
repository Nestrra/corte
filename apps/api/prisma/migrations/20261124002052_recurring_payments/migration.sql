-- CreateEnum
CREATE TYPE "recurring_frequency" AS ENUM ('monthly', 'annual');

-- CreateTable
CREATE TABLE "recurring_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "amount" BIGINT NOT NULL,
    "frequency" "recurring_frequency" NOT NULL,
    "first_due_date" DATE NOT NULL,
    "anchor_date" DATE NOT NULL,
    "starts_on" DATE NOT NULL,
    "paused_on" DATE,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recurring_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_occurrences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recurring_payment_id" UUID NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "due_date" DATE NOT NULL,
    "expected_amount" BIGINT NOT NULL,
    "paid_at" DATE,
    "paid_amount" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recurring_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_payments_user_id_deleted_at_idx" ON "recurring_payments"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "recurring_occurrences_recurring_payment_id_due_date_idx" ON "recurring_occurrences"("recurring_payment_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_occurrences_recurring_payment_id_period_key" ON "recurring_occurrences"("recurring_payment_id", "period");

-- AddForeignKey
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_occurrences" ADD CONSTRAINT "recurring_occurrences_recurring_payment_id_fkey" FOREIGN KEY ("recurring_payment_id") REFERENCES "recurring_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Range checks of data-model.md (spec 005), added by hand; Prisma cannot declare CHECK constraints.
-- No check between starts_on and first_due_date: editing may move the next due date earlier in the
-- same month (spec US5-4).
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_amount_range" CHECK ("amount" BETWEEN 1 AND 9999999999);
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_name_length" CHECK (char_length("name") BETWEEN 1 AND 40);

ALTER TABLE "recurring_occurrences" ADD CONSTRAINT "recurring_occurrences_period_format" CHECK ("period" ~ '^[0-9]{4}(-[0-9]{2})?$');
ALTER TABLE "recurring_occurrences" ADD CONSTRAINT "recurring_occurrences_expected_amount_range" CHECK ("expected_amount" BETWEEN 1 AND 9999999999);
ALTER TABLE "recurring_occurrences" ADD CONSTRAINT "recurring_occurrences_paid_amount_range" CHECK ("paid_amount" IS NULL OR "paid_amount" BETWEEN 1 AND 9999999999);
ALTER TABLE "recurring_occurrences" ADD CONSTRAINT "recurring_occurrences_payment_pair" CHECK (("paid_at" IS NULL) = ("paid_amount" IS NULL));
