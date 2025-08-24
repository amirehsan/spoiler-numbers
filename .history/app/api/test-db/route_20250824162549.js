import pool from '../../../lib/db';

export async function GET(request) {
  let client;

  try {
    console.log('🔗 Testing database connection...');
    client = await pool.connect();
    console.log('✅ Database connected successfully');

    // Test users table
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    console.log('👥 Users count:', userCount.rows[0].count);

    // Test random_numbers table
    const numbersCount = await client.query('SELECT COUNT(*) FROM random_numbers');
    console.log('🔢 Random numbers count:', numbersCount.rows[0].count);

    // Test recent records
    const recentNumbers = await client.query(`
      SELECT rn.*, u.first_name, u.telegram_id
      FROM random_numbers rn
      JOIN users u ON rn.user_id = u.id
      ORDER BY rn.created_at DESC
      LIMIT 5
    `);
    console.log('📋 Recent records:', recentNumbers.rows);

    // Test insert capability
    await client.query('BEGIN');
    const testInsert = await client.query(`
      INSERT INTO random_numbers (user_id, number, status)
      SELECT id, 999, 'test' FROM users LIMIT 1
      RETURNING *
    `);
    console.log('✅ Test insert successful:', testInsert.rows[0]);
    await client.query('ROLLBACK'); // Don't actually save test data

    return new Response(JSON.stringify({
      success: true,
      userCount: userCount.rows[0].count,
      numbersCount: numbersCount.rows[0].count,
      recentNumbers: recentNumbers.rows,
      message: 'Database connection and operations working correctly'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Database test error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    if (client) {
      client.release();
      console.log('🔌 Database connection released');
    }
  }
}git add