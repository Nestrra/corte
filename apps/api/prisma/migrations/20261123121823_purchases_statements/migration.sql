-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "annual_rate" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "purchases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "card_id" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "concept" VARCHAR(60) NOT NULL,
    "purchase_date" DATE NOT NULL,
    "installment_count" SMALLINT NOT NULL,
    "no_interest" BOOLEAN NOT NULL DEFAULT false,
    "annual_rate" DECIMAL(5,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purchase_id" UUID NOT NULL,
    "statement_id" UUID NOT NULL,
    "number" SMALLINT NOT NULL,
    "principal" BIGINT NOT NULL,
    "interest" BIGINT NOT NULL,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "card_id" UUID NOT NULL,
    "cutoff_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "paid_at" DATE,
    "paid_amount" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "statements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchases_card_id_purchase_date_created_at_idx" ON "purchases"("card_id", "purchase_date" DESC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "installments_statement_id_idx" ON "installments"("statement_id");

-- CreateIndex
CREATE UNIQUE INDEX "installments_purchase_id_number_key" ON "installments"("purchase_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "statements_card_id_cutoff_date_key" ON "statements"("card_id", "cutoff_date");

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statements" ADD CONSTRAINT "statements_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Range checks of data-model.md (spec 003), added by hand; Prisma cannot declare CHECK constraints.
ALTER TABLE "cards" ADD CONSTRAINT "cards_annual_rate_range" CHECK ("annual_rate" IS NULL OR "annual_rate" BETWEEN 0 AND 100);

ALTER TABLE "purchases" ADD CONSTRAINT "purchases_amount_range" CHECK ("amount" BETWEEN 1 AND 9999999999);
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_installment_count_range" CHECK ("installment_count" BETWEEN 1 AND 72);
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_annual_rate_range" CHECK ("annual_rate" IS NULL OR "annual_rate" BETWEEN 0 AND 100);
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_concept_length" CHECK (char_length("concept") BETWEEN 1 AND 60);

ALTER TABLE "installments" ADD CONSTRAINT "installments_number_range" CHECK ("number" BETWEEN 1 AND 72);
ALTER TABLE "installments" ADD CONSTRAINT "installments_amounts_non_negative" CHECK ("principal" >= 0 AND "interest" >= 0);

ALTER TABLE "statements" ADD CONSTRAINT "statements_due_after_cutoff" CHECK ("due_date" > "cutoff_date");
ALTER TABLE "statements" ADD CONSTRAINT "statements_payment_pair" CHECK (("paid_at" IS NULL) = ("paid_amount" IS NULL));
ALTER TABLE "statements" ADD CONSTRAINT "statements_paid_amount_non_negative" CHECK ("paid_amount" IS NULL OR "paid_amount" >= 0);
