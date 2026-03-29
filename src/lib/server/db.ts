import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";

declare global {
  var __prisma__: PrismaClient | undefined;
}

export function createPrismaClient(databaseUrl?: string) {
  const adapter = new PrismaLibSql({
    url: databaseUrl ?? process.env.DATABASE_URL ?? "file:./dev.db",
  });

  return new PrismaClient({
    adapter,
  });
}

export const prisma = globalThis.__prisma__ ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma__ = prisma;
}
