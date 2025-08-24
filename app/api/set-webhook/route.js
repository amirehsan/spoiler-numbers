import { bot } from '../../../lib/bot';

export async function GET(request) {
  const url = process.env.NEXT_PUBLIC_URL;

  if (!url) {
    return new Response(JSON.stringify({ message: 'NEXT_PUBLIC_URL not set' }), {
        status: 500,
        headers: {
            'Content-Type': 'application/json',
        },
    });
  }

  try {
    await bot.setWebHook(`${url}/api/telegram`);
    return new Response(JSON.stringify({ message: 'Webhook set' }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
        },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ message: 'Error setting webhook' }), {
        status: 500,
        headers: {
            'Content-Type': 'application/json',
        },
    });
  }
}
