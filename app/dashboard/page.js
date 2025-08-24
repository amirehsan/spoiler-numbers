import { Pool } from 'pg';

async function getData() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  const client = await pool.connect();

  try {
    const response = await client.query(`
      SELECT
        u.telegram_id,
        u.username,
        u.first_name,
        u.last_name,
        rn.number,
        rn.status,
        rn.created_at
      FROM users u
      LEFT JOIN random_numbers rn ON u.id = rn.user_id
      ORDER BY u.id, rn.created_at DESC;
    `);
    return response.rows;
  } catch (error) {
    console.error('Error fetching data:', error);
    return [];
  }
  finally {
    client.release();
  }
}

export default async function Dashboard() {
  const data = await getData();

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b">Telegram ID</th>
                <th className="py-2 px-4 border-b">Username</th>
                <th className="py-2 px-4 border-b">First Name</th>
                <th className="py-2 px-4 border-b">Last Name</th>
                <th className="py-2 px-4 border-b">Number</th>
                <th className="py-2 px-4 border-b">Status</th>
                <th className="py-2 px-4 border-b">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => (
                <tr key={index}>
                  <td className="py-2 px-4 border-b">{String(row.telegram_id)}</td>
                  <td className="py-2 px-4 border-b">{row.username}</td>
                  <td className="py-2 px-4 border-b">{row.first_name}</td>
                  <td className="py-2 px-4 border-b">{row.last_name}</td>
                  <td className="py-2 px-4 border-b">{row.number}</td>
                  <td className="py-2 px-4 border-b">{row.status}</td>
                  <td className="py-2 px-4 border-b">{row.created_at ? new Date(row.created_at).toLocaleString() : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
