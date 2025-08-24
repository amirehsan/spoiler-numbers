import { Pool } from 'pg';
import { StatusPieChart, NumberFrequencyBarChart } from './charts';

async function getData() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  const client = await pool.connect();

  try {
    // Query for recent activity
    const recentActivityQuery = client.query(`
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
      WHERE rn.id IS NOT NULL
      ORDER BY rn.created_at DESC
      LIMIT 100;
    `);

    // Query for statistics
    const statsQuery = client.query(`
        SELECT
            (SELECT COUNT(*) FROM users) AS total_users,
            (SELECT COUNT(*) FROM random_numbers) AS total_numbers,
            (SELECT COUNT(*) FROM random_numbers WHERE status = 'checked') AS checked_numbers,
            (SELECT COUNT(*) FROM random_numbers WHERE status = 'not-checked') AS not_checked_numbers
    `);

    // Query for bar chart data
    const barChartQuery = client.query(`
        SELECT number, COUNT(*)::int as count
        FROM random_numbers
        WHERE status = 'checked'
        GROUP BY number
        ORDER BY number ASC;
    `);

    // Await all promises in parallel
    const [recentActivityResult, statsResult, barChartResult] = await Promise.all([recentActivityQuery, statsQuery, barChartQuery]);

    return {
      recentActivity: recentActivityResult.rows,
      stats: statsResult.rows[0],
      barChartData: barChartResult.rows,
    };
  } catch (error) {
    console.error('Error fetching data:', error);
    // Return a default structure in case of error
    return {
      recentActivity: [],
      stats: { total_users: 0, total_numbers: 0, checked_numbers: 0, not_checked_numbers: 0 },
      barChartData: [],
    };
  }
  finally {
    client.release();
  }
}


export default async function Dashboard() {
  const { recentActivity, stats, barChartData } = await getData();
  const pieChartData = {
      checked: Number(stats.checked_numbers) || 0,
      notChecked: Number(stats.not_checked_numbers) || 0,
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans">
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white">TeleBot Dashboard</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-800 p-6 rounded-lg">
                <h2 className="text-lg font-medium text-gray-400">Total Users</h2>
                <p className="text-3xl font-bold">{String(stats.total_users)}</p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg">
                <h2 className="text-lg font-medium text-gray-400">Total Numbers</h2>
                <p className="text-3xl font-bold">{String(stats.total_numbers)}</p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg">
                <h2 className="text-lg font-medium text-gray-400">Checked</h2>
                <p className="text-3xl font-bold">{String(stats.checked_numbers)}</p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg">
                <h2 className="text-lg font-medium text-gray-400">Not-Checked</h2>
                <p className="text-3xl font-bold">{String(stats.not_checked_numbers)}</p>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <div className="lg:col-span-1 bg-gray-800 p-6 rounded-lg">
                <h2 className="text-xl font-bold mb-4">Status Distribution</h2>
                <StatusPieChart data={pieChartData} />
            </div>
            <div className="lg:col-span-2 bg-gray-800 p-6 rounded-lg">
                <h2 className="text-xl font-bold mb-4">Checked Number Frequency</h2>
                <NumberFrequencyBarChart data={barChartData} />
            </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow overflow-hidden">
            <h2 className="text-xl font-bold p-6">Recent Activity</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead className="bg-gray-700">
                        <tr>
                            <th className="text-left py-3 px-6 font-semibold">User</th>
                            <th className="text-left py-3 px-6 font-semibold">Number</th>
                            <th className="text-left py-3 px-6 font-semibold">Status</th>
                            <th className="text-left py-3 px-6 font-semibold">Timestamp</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {recentActivity.map((row, index) => (
                            <tr key={index} className="hover:bg-gray-700/50">
                                <td className="py-4 px-6">
                                    <div className="font-medium">{row.first_name || 'N/A'} {row.last_name || ''}</div>
                                    <div className="text-sm text-gray-400">@{row.username || 'N/A'}</div>
                                </td>
                                <td className="py-4 px-6 font-mono text-lg">{row.number}</td>
                                <td className="py-4 px-6">
                                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                        row.status === 'checked' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                                    }`}>
                                        {row.status}
                                    </span>
                                </td>
                                <td className="py-4 px-6 text-gray-400">{new Date(row.created_at).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </main>
    </div>
  );
}
