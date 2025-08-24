import { bot } from '../../../lib/bot';

export async function POST(request) {
  try {
    const body = await request.json();

    // Process update in background - don't wait for completion
    setImmediate(() => {
      try {
        bot.processUpdate(body);
      } catch (processErr) {
        console.error('Error processing update:', processErr);
      }
    });

    // Respond immediately to Telegram
    return new Response(JSON.stringify({ message: 'ok' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ message: 'error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

// Add timeout handling
export const maxDuration = 30; // Vercel timeout limit