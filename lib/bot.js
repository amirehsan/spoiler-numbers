import TelegramBot from 'node-telegram-bot-api';
import pool from './db'; // Using the new centralized pool

let bot;

if (process.env.TELEGRAM_BOT_TOKEN) {
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

  bot.onText(/\/start/, async (msg) => {
    const { id, username, first_name, last_name } = msg.from;
    let client;
    try {
      client = await pool.connect();
      const res = await client.query('SELECT * FROM users WHERE telegram_id = $1', [id]);
      if (res.rows.length === 0) {
        await client.query(
          'INSERT INTO users (telegram_id, username, first_name, last_name) VALUES ($1, $2, $3, $4)',
          [id, username, first_name, last_name]
        );
      }
    } catch (err) {
      console.error('Error in /start handler:', err);
    } finally {
      if (client) client.release();
    }

    bot.sendMessage(msg.chat.id, 'Welcome! Click the button to get a random number.', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Random Number', callback_data: 'random_number' }]
        ]
      }
    });
  });

  bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;

    bot.answerCallbackQuery(callbackQuery.id);

    if (data === 'random_number') {
      const randomNumber = Math.floor(Math.random() * 37);
      bot.sendMessage(msg.chat.id, `||${randomNumber}||`, {
          parse_mode: 'MarkdownV2',
          reply_markup: {
              inline_keyboard: [
                  [
                      { text: '✅', callback_data: `check_${randomNumber}` },
                      { text: '❌', callback_data: `uncheck_${randomNumber}` }
                  ]
              ]
          }
      });
    } else if (data.startsWith('check_') || data.startsWith('uncheck_')) {
      const [action, numberStr] = data.split('_');
      const number = parseInt(numberStr, 10);
      const status = action === 'check' ? 'checked' : 'not-checked';
      const userId = callbackQuery.from.id;
      let client;
      try {
        client = await pool.connect();
        const res = await client.query('SELECT id FROM users WHERE telegram_id = $1', [userId]);
        if (res.rows.length > 0) {
          const userDbId = res.rows[0].id;
          await client.query(
            'INSERT INTO random_numbers (user_id, number, status) VALUES ($1, $2, $3)',
            [userDbId, number, status]
          );
          bot.editMessageText(`You marked **${number}** as _${status}_.`, {
              chat_id: msg.chat.id,
              message_id: msg.message_id,
              parse_mode: 'Markdown'
          });
        } else {
           bot.editMessageText(`Could not find your user data. Please try /start again.`, {
              chat_id: msg.chat.id,
              message_id: msg.message_id,
          });
        }
      } catch (err) {
          console.error("Failed to process callback query:", err);
          bot.editMessageText(`An error occurred while processing your request for ${number}.`, {
              chat_id: msg.chat.id,
              message_id: msg.message_id,
          });
      } finally {
        if (client) client.release();
      }
    }
  });
} else {
  console.error('TELEGRAM_BOT_TOKEN is not set. The bot will not work.');
  // A stub bot object that prevents the app from crashing.
  bot = {
    onText: () => {},
    on: () => {},
    processUpdate: () => {},
    setWebHook: () => Promise.resolve(),
    sendMessage: () => Promise.resolve(),
    answerCallbackQuery: () => Promise.resolve(),
    editMessageText: () => Promise.resolve(),
  };
}

export { bot };