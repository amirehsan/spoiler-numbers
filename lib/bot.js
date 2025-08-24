import TelegramBot from 'node-telegram-bot-api';
import { Pool } from 'pg';

let bot;

if (process.env.NODE_ENV === 'development') {
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
} else {
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
}


const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

bot.onText(/\/start/, async (msg) => {
  const { id, username, first_name, last_name } = msg.from;

  const client = await pool.connect();
  try {
    const res = await client.query('SELECT * FROM users WHERE telegram_id = $1', [id]);
    if (res.rows.length === 0) {
      await client.query(
        'INSERT INTO users (telegram_id, username, first_name, last_name) VALUES ($1, $2, $3, $4)',
        [id, username, first_name, last_name]
      );
    }
  } finally {
    client.release();
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

    const client = await pool.connect();
    try {
      const res = await client.query('SELECT id FROM users WHERE telegram_id = $1', [userId]);
      if (res.rows.length > 0) {
        const userDbId = res.rows[0].id;
        await client.query(
          'INSERT INTO random_numbers (user_id, number, status) VALUES ($1, $2, $3)',
          [userDbId, number, status]
        );
        bot.answerCallbackQuery(callbackQuery.id, { text: `Number ${number} has been ${status}.` });
      }
    } finally {
      client.release();
    }
  }
});

export { bot };
