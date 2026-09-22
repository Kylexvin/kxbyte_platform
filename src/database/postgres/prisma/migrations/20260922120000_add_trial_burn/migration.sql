CREATE TABLE "trial_burns" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "productKey" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "burnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "trial_burns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trial_burns_ownerUserId_productKey_key" ON "trial_burns"("ownerUserId", "productKey");

CREATE INDEX "trial_burns_productKey_idx" ON "trial_burns"("productKey");

CREATE INDEX "trial_burns_organizationId_idx" ON "trial_burns"("organizationId");