/*
  Warnings:

  - You are about to drop the column `minStock` on the `kxtill_products` table. All the data in the column will be lost.
  - You are about to drop the column `stock` on the `kxtill_products` table. All the data in the column will be lost.
  - Added the required column `branchProductId` to the `kxtill_sale_items` table without a default value. This is not possible if the table is not empty.
  - Made the column `branchId` on table `kxtill_sales` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "kxtill_sales" DROP CONSTRAINT "kxtill_sales_branchId_fkey";

-- AlterTable
ALTER TABLE "kxtill_products" DROP COLUMN "minStock",
DROP COLUMN "stock";

-- AlterTable
ALTER TABLE "kxtill_sale_items" ADD COLUMN     "branchProductId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "kxtill_sales" ALTER COLUMN "branchId" SET NOT NULL;

-- CreateTable
CREATE TABLE "kxtill_branch_products" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "displayName" TEXT,
    "description" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "stock" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "minStock" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kxtill_branch_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kxtill_branch_product_unit_prices" (
    "id" TEXT NOT NULL,
    "branchProductId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kxtill_branch_product_unit_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kxtill_branch_products_productId_idx" ON "kxtill_branch_products"("productId");

-- CreateIndex
CREATE INDEX "kxtill_branch_products_branchId_idx" ON "kxtill_branch_products"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "kxtill_branch_products_productId_branchId_key" ON "kxtill_branch_products"("productId", "branchId");

-- CreateIndex
CREATE INDEX "kxtill_branch_product_unit_prices_branchProductId_idx" ON "kxtill_branch_product_unit_prices"("branchProductId");

-- CreateIndex
CREATE INDEX "kxtill_branch_product_unit_prices_unitId_idx" ON "kxtill_branch_product_unit_prices"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "kxtill_branch_product_unit_prices_branchProductId_unitId_key" ON "kxtill_branch_product_unit_prices"("branchProductId", "unitId");

-- CreateIndex
CREATE INDEX "kxtill_sale_items_branchProductId_idx" ON "kxtill_sale_items"("branchProductId");

-- CreateIndex
CREATE INDEX "kxtill_sales_branchId_idx" ON "kxtill_sales"("branchId");

-- AddForeignKey
ALTER TABLE "kxtill_branch_products" ADD CONSTRAINT "kxtill_branch_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "kxtill_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kxtill_branch_products" ADD CONSTRAINT "kxtill_branch_products_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kxtill_branch_product_unit_prices" ADD CONSTRAINT "kxtill_branch_product_unit_prices_branchProductId_fkey" FOREIGN KEY ("branchProductId") REFERENCES "kxtill_branch_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kxtill_branch_product_unit_prices" ADD CONSTRAINT "kxtill_branch_product_unit_prices_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "kxtill_product_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kxtill_sales" ADD CONSTRAINT "kxtill_sales_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kxtill_sale_items" ADD CONSTRAINT "kxtill_sale_items_branchProductId_fkey" FOREIGN KEY ("branchProductId") REFERENCES "kxtill_branch_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
