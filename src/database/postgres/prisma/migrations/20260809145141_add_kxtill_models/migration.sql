-- CreateTable
CREATE TABLE "kxtill_products" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "category" TEXT,
    "taxRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "baseUnitId" TEXT,
    "stock" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "minStock" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kxtill_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kxtill_product_units" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "unitType" TEXT NOT NULL,
    "conversionQty" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "price" DECIMAL(65,30),
    "allowFractional" BOOLEAN NOT NULL DEFAULT false,
    "barcode" TEXT,
    "isBaseUnit" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kxtill_product_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kxtill_sales" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "paymentStatus" TEXT NOT NULL DEFAULT 'PAID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kxtill_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kxtill_sale_items" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "unitAbbrev" TEXT NOT NULL,
    "unitType" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "conversionQty" DECIMAL(65,30) NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "baseQuantity" DECIMAL(65,30) NOT NULL,
    "taxRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kxtill_sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kxtill_sale_payments" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "reference" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kxtill_sale_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kxtill_products_baseUnitId_key" ON "kxtill_products"("baseUnitId");

-- CreateIndex
CREATE INDEX "kxtill_products_organizationId_idx" ON "kxtill_products"("organizationId");

-- CreateIndex
CREATE INDEX "kxtill_products_sku_idx" ON "kxtill_products"("sku");

-- CreateIndex
CREATE INDEX "kxtill_product_units_productId_idx" ON "kxtill_product_units"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "kxtill_product_units_productId_name_key" ON "kxtill_product_units"("productId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "kxtill_product_units_productId_abbreviation_key" ON "kxtill_product_units"("productId", "abbreviation");

-- CreateIndex
CREATE INDEX "kxtill_sales_organizationId_idx" ON "kxtill_sales"("organizationId");

-- CreateIndex
CREATE INDEX "kxtill_sales_userId_idx" ON "kxtill_sales"("userId");

-- CreateIndex
CREATE INDEX "kxtill_sales_status_idx" ON "kxtill_sales"("status");

-- CreateIndex
CREATE INDEX "kxtill_sales_paymentStatus_idx" ON "kxtill_sales"("paymentStatus");

-- CreateIndex
CREATE INDEX "kxtill_sales_createdAt_idx" ON "kxtill_sales"("createdAt");

-- CreateIndex
CREATE INDEX "kxtill_sale_items_saleId_idx" ON "kxtill_sale_items"("saleId");

-- CreateIndex
CREATE INDEX "kxtill_sale_items_productId_idx" ON "kxtill_sale_items"("productId");

-- CreateIndex
CREATE INDEX "kxtill_sale_items_unitId_idx" ON "kxtill_sale_items"("unitId");

-- CreateIndex
CREATE INDEX "kxtill_sale_payments_saleId_idx" ON "kxtill_sale_payments"("saleId");

-- CreateIndex
CREATE INDEX "kxtill_sale_payments_method_idx" ON "kxtill_sale_payments"("method");

-- AddForeignKey
ALTER TABLE "kxtill_products" ADD CONSTRAINT "kxtill_products_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kxtill_products" ADD CONSTRAINT "kxtill_products_baseUnitId_fkey" FOREIGN KEY ("baseUnitId") REFERENCES "kxtill_product_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kxtill_product_units" ADD CONSTRAINT "kxtill_product_units_productId_fkey" FOREIGN KEY ("productId") REFERENCES "kxtill_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kxtill_sales" ADD CONSTRAINT "kxtill_sales_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kxtill_sales" ADD CONSTRAINT "kxtill_sales_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kxtill_sale_items" ADD CONSTRAINT "kxtill_sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "kxtill_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kxtill_sale_items" ADD CONSTRAINT "kxtill_sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "kxtill_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kxtill_sale_items" ADD CONSTRAINT "kxtill_sale_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "kxtill_product_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kxtill_sale_payments" ADD CONSTRAINT "kxtill_sale_payments_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "kxtill_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
