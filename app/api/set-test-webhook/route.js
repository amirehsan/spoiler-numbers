import TelegramBot from 'node-telegram-bot-api';

export async function GET(request) {
  const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
  const url = process.env.NEXT_PUBLIC_URL;

  if (!url) {
    return new Response(JSON.stringify({ message: 'NEXT_PUBLIC_URL not set' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Set webhook to test endpoint
    await bot.setWebHook(`${url}/api/bot-test`);
    return new Response(JSON.stringify({
      message: 'Test webhook set successfully',
      webhook_url: `${url}/api/bot-test`
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({
      message: 'Error setting test webhook',
      error: error.message
    }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
    });
  }
}