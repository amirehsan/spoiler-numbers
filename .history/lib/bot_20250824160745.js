import TelegramBot from 'node-telegram-bot-api';
import { Pool } from 'pg';

let bot;

if (process.env.TELEGRAM_BOT_TOKEN) {
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

  // Optimized pool for serverless/Vercel
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: {
      rejectUnauthorized: false
    },
    // Serverless-optimized settings
    max: 1, // Single connection for serverless
    idleTimeoutMillis: 1000, // Close connections quickly
    connectionTimeoutMillis: 5000, // Short timeout
    query_timeout: 5000, // Query timeout
    statement_timeout: 5000, // Statement timeout
  });

  bot.onText(/\/start/, async (msg) => {
    const { id, username, first_name, last_name } = msg.from;
    let client;

    try {
      // Quick response to user first
      await bot.sendMessage(msg.chat.id, 'Welcome! Click the button to get a random number.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Random Number', callback_data: 'random_number' }]
          ]
        }
      });

      // Then handle database in background
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
      // Don't throw - user already got response
    } finally {
      if (client) client.release();
    }
  });

  bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;

    try {
      // IMMEDIATELY acknowledge callback to prevent timeout
      await bot.answerCallbackQuery(callbackQuery.id);

      if (data === 'random_number') {
        const randomNumber = Math.floor(Math.random() * 37);
        await bot.sendMessage(msg.chat.id, `||${randomNumber}||`, {
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
          // Update UI immediately
          await bot.editMessageText(`You marked **${number}** as _${status}_.`, {
            chat_id: msg.chat.id,
            message_id: msg.message_id,
            parse_mode: 'Markdown'
          });

          // Then save to database
          client = await pool.connect();
          const res = await client.query('SELECT id FROM users WHERE telegram_id = $1', [userId]);
          if (res.rows.length > 0) {
            const userDbId = res.rows[0].id;
            await client.query(
              'INSERT INTO random_numbers (user_id, number, status) VALUES ($1, $2, $3)',
              [userDbId, number, status]
            );
          }
        } catch (dbErr) {
          console.error("Database error in callback:", dbErr);
          // Don't update UI again - user already sees the action completed
        } finally {
          if (client) client.release();
        }
      }
    } catch (err) {
      console.error("Failed to process callback query:", err);
      try {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "Sorry, something went wrong. Please try again.",
          show_alert: true
        });
      } catch (ackErr) {
        console.error("Failed to acknowledge callback:", ackErr);
      }
    }
  });
} else {
  console.error('TELEGRAM_BOT_TOKEN is not set. The bot will not work.');
  // Stub bot object
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