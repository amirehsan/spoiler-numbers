import { Pool } from 'pg';

// This ensures we only create one single pool instance for the entire application.
let pool;

if (!pool) {
  pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: {
      rejectUnauthorized: false,
    },
    // Serverless-optimized settings
    max: 1, // Use a single connection to avoid overwhelming the database
    idleTimeoutMillis: 10000, // Close idle connections after 10 seconds
    connectionTimeoutMillis: 10000, // Fail if a connection can't be made in 10 seconds
  });
}

export default pool;