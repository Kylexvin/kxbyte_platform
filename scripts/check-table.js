// scripts/check-tables.js
import prisma from '../src/database/postgres/prisma.js';

async function main() {
  const result = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE 'kxtill%'
    ORDER BY table_name
  `;
  console.log(result);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());