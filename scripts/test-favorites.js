// scripts/test-favorites.js — throwaway. Delete after verifying.
import 'dotenv/config';
import favoritesService from '../src/modules/products/kxtill/mobile/services/favorites.service.js';

const ctx = {
  organizationId: 'e917d646-e4ee-40c7-a8d1-f3ad5d1fc990',
  user: { id: '0f8e27ad-a89e-43cd-95ec-7be65f3c2662' },
  activeBranchId: '0fb324f4-b05b-4487-920a-c29af4ed97ce',
};

const branchId = ctx.activeBranchId;
const productId = '5f0f50d4-25c1-4a2e-848c-f364f5456e89';

console.log('1. list (should be [])');
console.log(await favoritesService.listFavorites(ctx, branchId));

console.log('2. toggle on');
console.log(await favoritesService.toggleFavorite(ctx, branchId, productId));

console.log('3. list (should contain Apple Juice)');
console.log(
  JSON.stringify(await favoritesService.listFavorites(ctx, branchId), null, 2)
);

console.log('4. toggle off');
console.log(await favoritesService.toggleFavorite(ctx, branchId, productId));

console.log('5. list (should be [])');
console.log(await favoritesService.listFavorites(ctx, branchId));