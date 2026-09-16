// prisma.config.js

export default {
  schema: 'src/database/postgres/prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
}; 