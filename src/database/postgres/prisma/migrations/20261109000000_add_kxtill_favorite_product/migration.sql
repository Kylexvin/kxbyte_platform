-- CreateTable
CREATE TABLE IF NOT EXISTS "kxtill_favorite_products" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kxtill_favorite_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "kxtill_favorite_products_userId_branchId_productId_key"
    ON "kxtill_favorite_products"("userId", "branchId", "productId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "kxtill_favorite_products_organizationId_branchId_idx"
    ON "kxtill_favorite_products"("organizationId", "branchId");