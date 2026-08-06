// src/database/postgres/prisma.js

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  user: 'postgres',
  password: '5595',
  host: 'localhost',
  port: 5432,
  database: 'kxbyte',
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

export default prisma;