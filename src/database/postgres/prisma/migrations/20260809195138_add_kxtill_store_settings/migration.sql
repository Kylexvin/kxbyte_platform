-- CreateTable
CREATE TABLE "kxtill_store_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "shopName" TEXT,
    "shopPhone" TEXT,
    "shopAddress" TEXT,
    "shopEmail" TEXT,
    "taxNumber" TEXT,
    "receiptFooter" TEXT,
    "receiptHeader" TEXT,
    "showTax" BOOLEAN NOT NULL DEFAULT false,
    "showCustomer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kxtill_store_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kxtill_store_settings_organizationId_key" ON "kxtill_store_settings"("organizationId");

-- AddForeignKey
ALTER TABLE "kxtill_store_settings" ADD CONSTRAINT "kxtill_store_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
