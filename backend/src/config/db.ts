import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/vtov_db';

let isLocal = false;
try {
  const parsed = new URL(databaseUrl);
  const hostname = parsed.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'db' || hostname === 'host.docker.internal') {
    isLocal = true;
  }
} catch (e) {
  isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1') || databaseUrl.includes('db:') || databaseUrl.includes('host.docker.internal');
}

const isProduction = process.env.NODE_ENV === 'production' || !isLocal;

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});
