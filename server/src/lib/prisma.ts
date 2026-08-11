import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.DATABASE_URL || '';
const parsed = new URL(url);

const adapter = new PrismaMariaDb({
  host: parsed.hostname,
  port: parseInt(parsed.port) || 3306,
  user: parsed.username,
  password: parsed.password,
  database: parsed.pathname.slice(1),
  connectionLimit: 10,
});

const prisma = new PrismaClient({ adapter });

export default prisma;
