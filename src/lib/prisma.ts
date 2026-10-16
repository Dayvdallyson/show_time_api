import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL undefined");

export const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseUrl) });
