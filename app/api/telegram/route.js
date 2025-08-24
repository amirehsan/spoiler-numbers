import { bot } from '../../../lib/bot';

export async function POST(request) {
  try {
    const body = await request.json();
    bot.processUpdate(body);
    return new Response(JSON.stringify({ message: 'ok' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ message: 'error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
