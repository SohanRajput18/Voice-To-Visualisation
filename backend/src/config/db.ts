import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/vtov_db';

export const pool = new Pool({
  connectionString: databaseUrl,
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});
