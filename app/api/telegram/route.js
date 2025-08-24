import { bot } from '../../../lib/bot';

export async function POST(request) {
  try {
    const body = await request.json();

    // Respond to Telegram IMMEDIATELY
    const response = new Response(JSON.stringify({ message: 'ok' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Process update after response (non-blocking)
    setImmediate(() => {
      try {
        bot.processUpdate(body);
      } catch (processErr) {
        console.error('Error processing update:', processErr);
      }
    });

    return response;
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ message: 'ok' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

export const maxDuration = 10; // Reduce timeout to 10 seconds