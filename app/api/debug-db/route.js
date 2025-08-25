import pool from '../../../lib/db';

export async function GET(request) {
  let client;

  try {
    client = await pool.connect();

    // Get all users
    const users = await client.query('SELECT * FROM users ORDER BY id DESC');

    // Get all random numbers
    const numbers = await client.query(`
      SELECT rn.*, u.telegram_id, u.username, u.first_name
      FROM random_numbers rn
      JOIN users u ON rn.user_id = u.id
      ORDER BY rn.created_at DESC
    `);

    // Get counts
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    const numberCount = await client.query('SELECT COUNT(*) FROM random_numbers');
    const checkedCount = await client.query("SELECT COUNT(*) FROM random_numbers WHERE status = 'checked'");
    const uncheckedCount = await client.query("SELECT COUNT(*) FROM random_numbers WHERE status = 'not-checked'");

    // Get recent activity (last 10)
    const recentActivity = await client.query(`
      SELECT rn.*, u.telegram_id, u.username, u.first_name, u.last_name
      FROM random_numbers rn
      JOIN users u ON rn.user_id = u.id
      ORDER BY rn.created_at DESC
      LIMIT 10
    `);

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      counts: {
        users: userCount.rows[0].count,
        total_numbers: numberCount.rows[0].count,
        checked: checkedCount.rows[0].count,
        unchecked: uncheckedCount.rows[0].count
      },
      users: users.rows,
      all_numbers: numbers.rows,
      recent_activity: recentActivity.rows
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Database debug error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    if (client) client.release();
  }
}