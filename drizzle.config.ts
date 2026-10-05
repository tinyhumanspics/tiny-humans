import { defineConfig } from "drizzle-kit";

/** Drizzle Kit: `npm run db:generate` (create SQL migration), `npm run db:migrate` (apply to DATABASE_URL). */
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
});
