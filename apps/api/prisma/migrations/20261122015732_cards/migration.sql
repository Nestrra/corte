-- CreateEnum
CREATE TYPE "card_color" AS ENUM ('indigo', 'petroleo', 'ciruela', 'grafito', 'bosque', 'terracota');

-- CreateTable
CREATE TABLE "cards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "color" "card_color" NOT NULL,
    "last4" CHAR(4),
    "cutoff_day" SMALLINT NOT NULL,
    "due_day" SMALLINT NOT NULL,
    "credit_limit" BIGINT NOT NULL,
    "cycle_budget" BIGINT NOT NULL,
    "remind_cutoff_days" SMALLINT NOT NULL DEFAULT 2,
    "remind_due_days" SMALLINT NOT NULL DEFAULT 3,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cards_user_id_archived_at_created_at_idx" ON "cards"("user_id", "archived_at", "created_at");

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Range checks of data-model.md → Card (added by hand; Prisma cannot declare CHECK constraints).
ALTER TABLE "cards" ADD CONSTRAINT "cards_cutoff_day_range" CHECK ("cutoff_day" BETWEEN 1 AND 31);
ALTER TABLE "cards" ADD CONSTRAINT "cards_due_day_range" CHECK ("due_day" BETWEEN 1 AND 31);
ALTER TABLE "cards" ADD CONSTRAINT "cards_remind_days_range" CHECK ("remind_cutoff_days" BETWEEN 0 AND 15 AND "remind_due_days" BETWEEN 0 AND 15);
ALTER TABLE "cards" ADD CONSTRAINT "cards_amounts_range" CHECK ("credit_limit" BETWEEN 1 AND 9999999999 AND "cycle_budget" BETWEEN 1 AND 9999999999);
ALTER TABLE "cards" ADD CONSTRAINT "cards_budget_within_limit" CHECK ("cycle_budget" <= "credit_limit");
ALTER TABLE "cards" ADD CONSTRAINT "cards_last4_format" CHECK ("last4" IS NULL OR "last4" ~ '^[0-9]{4}$');
ALTER TABLE "cards" ADD CONSTRAINT "cards_name_length" CHECK (char_length("name") BETWEEN 1 AND 40);
