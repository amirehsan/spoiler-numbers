import { Pool } from 'pg';

export async function GET(request) {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  const client = await pool.connect();

  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(255),
        first_name VARCHAR(255),
        last_name VARCHAR(255)
      );
    `);

    // Create random_numbers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS random_numbers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        number INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    return new Response(JSON.stringify({ message: 'Database setup complete' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } finally {
    client.release();
  }
}
