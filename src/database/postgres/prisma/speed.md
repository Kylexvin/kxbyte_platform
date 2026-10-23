// prisma/schema.prisma

model KxTillSale {
  // ... existing fields ...
  @@index([organizationId, branchId, status, createdAt])
  @@index([organizationId, status, createdAt])
}

model KxTillSaleItem {
  // ... existing fields ...
  @@index([saleId])
  @@index([productId])
}

model KxTillSalePayment {
  // ... existing fields ...
  @@index([saleId])
  @@index([method])
}

model KxTillBranchProduct {
  // ... existing fields ...
  @@index([branchId, stock])
  @@index([productId, branchId])
}