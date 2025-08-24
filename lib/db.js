import { Pool } from 'pg';

let pool;

if (process.env.POSTGRES_URL) {
  pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: {
      rejectUnauthorized: false
    },
    // Ultra-fast settings for immediate responses
    max: 1, // Single connection only
    idleTimeoutMillis: 1000, // Close connections quickly
    connectionTimeoutMillis: 2000, // Very short connection timeout
    query_timeout: 3000, // Short query timeout
    statement_timeout: 3000,
    // Keep connections alive but close them fast
    keepAlive: false,
  });

  // Handle pool errors gracefully
  pool.on('error', (err) => {
    console.error('Database pool error:', err);
  });

  // Pre-warm the pool (optional)
  pool.on('connect', (client) => {
    console.log('Database client connected');
  });

} else {
  console.error('POSTGRES_URL is not set. Database features will not work.');
  pool = null;
}

export default pool;