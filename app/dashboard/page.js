import pool from '../../lib/db'; // Use centralized pool
import { StatusPieChart, NumberFrequencyBarChart } from './charts';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

async function getData() {
  if (!pool) {
    return {
      recentActivity: [],
      stats: { total_users: 0, total_numbers: 0, checked_numbers: 0, not_checked_numbers: 0 },
      barChartData: [],
    };
  }

  let client;
  try {
    client = await pool.connect();

    // Force read from primary (avoid read replicas)
    await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE');

    // Query for recent activity with explicit ordering
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

    // Query for statistics with explicit counting
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

    // Wait for all queries
    const [recentActivityResult, statsResult, barChartResult] = await Promise.all([
      recentActivityQuery,
      statsQuery,
      barChartQuery
    ]);

    return {
      recentActivity: recentActivityResult.rows,
      stats: statsResult.rows[0] || { total_users: 0, total_numbers: 0, checked_numbers: 0, not_checked_numbers: 0 },
      barChartData: barChartResult.rows,
    };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return {
      recentActivity: [],
      stats: { total_users: 0, total_numbers: 0, checked_numbers: 0, not_checked_numbers: 0 },
      barChartData: [],
    };
  } finally {
    if (client) client.release();
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
          <div className="text-sm text-gray-400 mt-2 sm:mt-0">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
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
                <p className="text-3xl font-bold text-green-400">{String(stats.checked_numbers)}</p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg">
                <h2 className="text-lg font-medium text-gray-400">Not-Checked</h2>
                <p className="text-3xl font-bold text-red-400">{String(stats.not_checked_numbers)}</p>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <div className="lg:col-span-1 bg-gray-800 p-6 rounded-lg">
                <h2 className="text-xl font-bold mb-4">Status Distribution</h2>
                <StatusPieChart data={pieChartData} />
            </div>
            <div className="lg:col-span-2 bg-gray-800 p-6 rounded-lg">
                <h2 className="text-xl font-bold mb-4">Number Frequency</h2>
                <NumberFrequencyBarChart data={barChartData} />
            </div>
        </div>

        <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700">
                <h2 className="text-xl font-bold">Recent Activity</h2>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Number</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {recentActivity.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-4 text-center text-gray-400">
                                    No activity yet. Try using the bot!
                                </td>
                            </tr>
                        ) : (
                            recentActivity.map((activity, index) => (
                                <tr key={index} className="hover:bg-gray-700">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div>
                                            <div className="text-sm font-medium text-white">
                                                {activity.first_name} {activity.last_name}
                                            </div>
                                            <div className="text-sm text-gray-400">@{activity.username}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                                        {activity.number}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                            activity.status === 'checked'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-red-100 text-red-800'
                                        }`}>
                                            {activity.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                        {new Date(activity.created_at).toLocaleString()}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </main>
    </div>
  );
}