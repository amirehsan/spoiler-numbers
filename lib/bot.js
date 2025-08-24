import TelegramBot from 'node-telegram-bot-api';
import pool from './db';

let bot;

if (process.env.TELEGRAM_BOT_TOKEN) {
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

  bot.onText(/\/start/, async (msg) => {
    const { id, username, first_name, last_name } = msg.from;

    // IMMEDIATE response - no database operations first
    try {
      await bot.sendMessage(msg.chat.id, 'Welcome! Click the button to get a random number.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Random Number', callback_data: 'random_number' }]
          ]
        }
      });
    } catch (err) {
      console.error('Failed to send welcome message:', err);
      return;
    }

    // Database operations in background (don't await)
    setImmediate(async () => {
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
        console.error('Background user registration error:', err);
      } finally {
        if (client) client.release();
      }
    });
  });

  bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;

    // IMMEDIATE acknowledgment
    try {
      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (err) {
      console.error('Failed to acknowledge callback:', err);
    }

    if (data === 'random_number') {
      // IMMEDIATE response with random number
      try {
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
      } catch (err) {
        console.error('Failed to send random number:', err);
      }

    } else if (data.startsWith('check_') || data.startsWith('uncheck_')) {
      const [action, numberStr] = data.split('_');
      const number = parseInt(numberStr, 10);
      const status = action === 'check' ? 'checked' : 'not-checked';

      // IMMEDIATE UI response
      try {
        await bot.editMessageText(`You marked **${number}** as _${status}_.`, {
          chat_id: msg.chat.id,
          message_id: msg.message_id,
          parse_mode: 'Markdown'
        });
      } catch (err) {
        console.error('Failed to update message:', err);
      }

      // Database operations in background (don't await)
      setImmediate(async () => {
        let client;
        try {
          client = await pool.connect();

          // Find or create user first
          let userRes = await client.query('SELECT id FROM users WHERE telegram_id = $1', [userId]);

          if (userRes.rows.length === 0) {
            // User doesn't exist, create them
            await client.query(
              'INSERT INTO users (telegram_id, username, first_name, last_name) VALUES ($1, $2, $3, $4)',
              [userId, callbackQuery.from.username, callbackQuery.from.first_name, callbackQuery.from.last_name]
            );
            userRes = await client.query('SELECT id FROM users WHERE telegram_id = $1', [userId]);
          }

          if (userRes.rows.length > 0) {
            const userDbId = userRes.rows[0].id;
            await client.query('BEGIN');
            await client.query(
              'INSERT INTO random_numbers (user_id, number, status) VALUES ($1, $2, $3)',
              [userDbId, number, status]
            );
            await client.query('COMMIT');
            console.log(`✅ Saved: User ${userId}, Number ${number}, Status ${status}`);
          }
        } catch (err) {
          console.error('Background database save error:', err);
          if (client) {
            try {
              await client.query('ROLLBACK');
            } catch (rollbackErr) {
              console.error('Rollback error:', rollbackErr);
            }
          }
        } finally {
          if (client) client.release();
        }
      });
    }
  });
} else {
  console.error('TELEGRAM_BOT_TOKEN is not set.');
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