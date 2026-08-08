-- CreateTable
CREATE TABLE "payment_merchant_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'PESAPAL',
    "environment" TEXT NOT NULL,
    "consumerKey" TEXT NOT NULL,
    "consumerSecret" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_merchant_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT,
    "productReference" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'PESAPAL',
    "merchantReference" TEXT NOT NULL,
    "orderTrackingId" TEXT,
    "confirmationCode" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "paymentAccount" TEXT,
    "redirectUrl" TEXT,
    "callbackUrl" TEXT,
    "cancellationUrl" TEXT,
    "notificationId" TEXT,
    "billingEmail" TEXT,
    "billingPhone" TEXT,
    "billingFirstName" TEXT,
    "billingLastName" TEXT,
    "billingCountry" TEXT,
    "billingLine1" TEXT,
    "billingCity" TEXT,
    "billingState" TEXT,
    "metadata" JSONB,
    "ipnReceived" BOOLEAN NOT NULL DEFAULT false,
    "ipnPayload" JSONB,
    "statusCode" INTEGER,
    "statusDescription" TEXT,
    "createdDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_ipn_registrations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'PESAPAL',
    "ipnId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "notificationType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_ipn_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_merchant_configs_organizationId_key" ON "payment_merchant_configs"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_merchantReference_key" ON "payment_transactions"("merchantReference");

-- CreateIndex
CREATE INDEX "payment_transactions_organizationId_idx" ON "payment_transactions"("organizationId");

-- CreateIndex
CREATE INDEX "payment_transactions_orderTrackingId_idx" ON "payment_transactions"("orderTrackingId");

-- CreateIndex
CREATE INDEX "payment_transactions_status_idx" ON "payment_transactions"("status");

-- CreateIndex
CREATE INDEX "payment_transactions_createdAt_idx" ON "payment_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "payment_ipn_registrations_organizationId_idx" ON "payment_ipn_registrations"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_ipn_registrations_organizationId_provider_ipnId_key" ON "payment_ipn_registrations"("organizationId", "provider", "ipnId");

-- AddForeignKey
ALTER TABLE "payment_merchant_configs" ADD CONSTRAINT "payment_merchant_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_ipn_registrations" ADD CONSTRAINT "payment_ipn_registrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
