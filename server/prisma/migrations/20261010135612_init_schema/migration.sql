-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('EMPLOYEE', 'DIRECTOR', 'ACCOUNTS');

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SignatureType" AS ENUM ('EMPLOYEE', 'DIRECTOR');

-- CreateEnum
CREATE TYPE "VoucherEventType" AS ENUM ('CREATED', 'UPDATED', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "fullName" VARCHAR(160) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "employeeId" VARCHAR(32),
    "departmentId" UUID,
    "passwordHash" VARCHAR(255),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" UUID NOT NULL,
    "voucherNumber" VARCHAR(32) NOT NULL,
    "voucherDate" DATE NOT NULL,
    "expenseDate" DATE NOT NULL,
    "departmentId" UUID NOT NULL,
    "expenseTitle" VARCHAR(160) NOT NULL,
    "expenseCategoryId" UUID NOT NULL,
    "expenseDescription" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "createdById" UUID NOT NULL,
    "employeeIdSnapshot" VARCHAR(32),
    "employeeNameSnapshot" VARCHAR(160),
    "status" "VoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMPTZ(3),
    "reviewedById" UUID,
    "approvedAt" TIMESTAMPTZ(3),
    "rejectedAt" TIMESTAMPTZ(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signatures" (
    "id" UUID NOT NULL,
    "voucherId" UUID NOT NULL,
    "type" "SignatureType" NOT NULL,
    "uploadedById" UUID NOT NULL,
    "storageKey" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_events" (
    "id" UUID NOT NULL,
    "voucherId" UUID NOT NULL,
    "actorId" UUID,
    "type" "VoucherEventType" NOT NULL,
    "fromStatus" "VoucherStatus",
    "toStatus" "VoucherStatus",
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voucher_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_code_key" ON "expense_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_name_key" ON "expense_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeId_key" ON "users"("employeeId");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "users"("role");

-- CreateIndex
CREATE INDEX "idx_users_department" ON "users"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_voucherNumber_key" ON "vouchers"("voucherNumber");

-- CreateIndex
CREATE INDEX "idx_vouchers_created_by" ON "vouchers"("createdById");

-- CreateIndex
CREATE INDEX "idx_vouchers_department" ON "vouchers"("departmentId");

-- CreateIndex
CREATE INDEX "idx_vouchers_category" ON "vouchers"("expenseCategoryId");

-- CreateIndex
CREATE INDEX "idx_vouchers_status" ON "vouchers"("status");

-- CreateIndex
CREATE INDEX "idx_vouchers_expense_date" ON "vouchers"("expenseDate");

-- CreateIndex
CREATE INDEX "idx_vouchers_created_at" ON "vouchers"("createdAt");

-- CreateIndex
CREATE INDEX "idx_vouchers_status_created_at" ON "vouchers"("status", "createdAt");

-- CreateIndex
CREATE INDEX "idx_vouchers_employee_status" ON "vouchers"("createdById", "status");

-- CreateIndex
CREATE INDEX "idx_signatures_uploaded_by" ON "signatures"("uploadedById");

-- CreateIndex
CREATE INDEX "idx_signatures_sha256" ON "signatures"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "uq_signature_voucher_type" ON "signatures"("voucherId", "type");

-- CreateIndex
CREATE INDEX "idx_voucher_events_timeline" ON "voucher_events"("voucherId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_voucher_events_actor" ON "voucher_events"("actorId");

-- CreateIndex
CREATE INDEX "idx_voucher_events_type" ON "voucher_events"("type");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_expenseCategoryId_fkey" FOREIGN KEY ("expenseCategoryId") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_events" ADD CONSTRAINT "voucher_events_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_events" ADD CONSTRAINT "voucher_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ==============================================================================
-- Database-level guarantees that Prisma's schema language cannot express.
-- ==============================================================================

-- Collision-safe voucher numbering.
--
-- A dedicated sequence provides atomic, gap-tolerant allocation: concurrent
-- transactions can never receive the same value, so duplicates are impossible
-- without any application-level locking. `voucherNumber` additionally carries a
-- UNIQUE constraint as a final backstop.
--
-- Gaps are acceptable and expected (a rolled-back transaction consumes a value).
-- The sequence is intentionally NOT reset by ordinary seeding.
CREATE SEQUENCE IF NOT EXISTS "voucher_number_seq" AS BIGINT START WITH 1 INCREMENT BY 1 NO CYCLE;

-- Monetary amounts must be strictly positive. Application validation is not a
-- substitute for this: the database is the last line of defence.
ALTER TABLE "vouchers"
  ADD CONSTRAINT "chk_vouchers_amount_positive" CHECK ("amount" > 0);

-- Rejection requires a recorded reason (workflow rule, enforced in the database
-- so an APPROVED/REJECTED voucher can never lack its audit justification).
ALTER TABLE "vouchers"
  ADD CONSTRAINT "chk_vouchers_rejected_has_reason"
  CHECK ("status" <> 'REJECTED' OR ("rejectionReason" IS NOT NULL AND length(trim("rejectionReason")) > 0));

-- An approved voucher must record who approved it and when.
ALTER TABLE "vouchers"
  ADD CONSTRAINT "chk_vouchers_approved_has_reviewer"
  CHECK ("status" <> 'APPROVED' OR ("reviewedById" IS NOT NULL AND "approvedAt" IS NOT NULL));

-- Signatures must be non-empty and within the documented size ceiling.
ALTER TABLE "signatures"
  ADD CONSTRAINT "chk_signatures_size_positive" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 2097152);

-- Normalise emails to lower case so uniqueness is case-insensitive in practice.
CREATE UNIQUE INDEX "uq_users_email_lower" ON "users" (lower("email"));
