import TelegramBot from 'node-telegram-bot-api';

export async function POST(request) {
  try {
    const body = await request.json();
    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

    console.log('🤖 Processing update:', body);

    // Handle /start command
    if (body.message && body.message.text === '/start') {
      console.log('📝 /start command received');

      await bot.sendMessage(body.message.chat.id, 'Hello! Bot is working directly. Click for a number:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Get Random Number', callback_data: 'test_random' }]
          ]
        }
      });

      console.log('✅ /start response sent');
    }

    // Handle callback queries
    if (body.callback_query) {
      console.log('🔄 Callback query received:', body.callback_query.data);

      await bot.answerCallbackQuery(body.callback_query.id);

      if (body.callback_query.data === 'test_random') {
        const randomNum = Math.floor(Math.random() * 37);

        await bot.editMessageText(`Your random number is: **${randomNum}**`, {
          chat_id: body.callback_query.message.chat.id,
          message_id: body.callback_query.message.message_id,
          parse_mode: 'Markdown'
        });

        console.log('✅ Random number sent:', randomNum);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Bot error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const maxDuration = 10;