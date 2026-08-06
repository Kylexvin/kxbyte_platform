import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "src/database/postgres/prisma/schema.prisma",
  migrations: {
    path: "src/database/postgres/prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});