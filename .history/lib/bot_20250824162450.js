import TelegramBot from 'node-telegram-bot-api';
import pool from './db';

let bot;

if (process.env.TELEGRAM_BOT_TOKEN) {
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

  bot.onText(/\/start/, async (msg) => {
    console.log('🚀 /start command received from user:', msg.from.id);
    const { id, username, first_name, last_name } = msg.from;
    let client;

    try {
      // Respond to user first
      await bot.sendMessage(msg.chat.id, 'Welcome! Click the button to get a random number.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Random Number', callback_data: 'random_number' }]
          ]
        }
      });
      console.log('✅ Welcome message sent');

      // Handle database
      client = await pool.connect();
      console.log('🔗 Database connected for user registration');

      const res = await client.query('SELECT * FROM users WHERE telegram_id = $1', [id]);
      console.log('👤 User lookup result:', res.rows.length > 0 ? 'Found existing' : 'New user');

      if (res.rows.length === 0) {
        await client.query(
          'INSERT INTO users (telegram_id, username, first_name, last_name) VALUES ($1, $2, $3, $4)',
          [id, username, first_name, last_name]
        );
        console.log('✅ New user created in database');
      }
    } catch (err) {
      console.error('❌ Error in /start handler:', err);
    } finally {
      if (client) client.release();
      console.log('🔌 Database connection released');
    }
  });

  bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;

    console.log('🔄 Callback query received:', {
      userId,
      data,
      chatId: msg.chat.id,
      messageId: msg.message_id
    });

    let client;

    try {
      // IMMEDIATELY acknowledge callback
      await bot.answerCallbackQuery(callbackQuery.id);
      console.log('✅ Callback acknowledged');

      if (data === 'random_number') {
        console.log('🎲 Random number requested');
        const randomNumber = Math.floor(Math.random() * 37);
        console.log('🎯 Generated number:', randomNumber);

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
        console.log('✅ Random number message sent with buttons');

      } else if (data.startsWith('check_') || data.startsWith('uncheck_')) {
        console.log('💾 Database operation requested for:', data);

        const [action, numberStr] = data.split('_');
        const number = parseInt(numberStr, 10);
        const status = action === 'check' ? 'checked' : 'not-checked';

        console.log('📊 Processing:', { action, number, status, userId });

        try {
          // Get database connection
          console.log('🔗 Getting database connection...');
          client = await Promise.race([
            pool.connect(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Connection timeout')), 5000)
            )
          ]);
          console.log('✅ Database connected');

          // Start transaction
          await client.query('BEGIN');
          console.log('🔄 Transaction started');

          // Find user
          const userRes = await client.query('SELECT id FROM users WHERE telegram_id = $1', [userId]);
          console.log('👤 User lookup:', userRes.rows.length > 0 ? `Found user ID: ${userRes.rows[0]?.id}` : 'User not found');

          if (userRes.rows.length > 0) {
            const userDbId = userRes.rows[0].id;

            // Insert the record
            console.log('💾 Inserting record:', { userDbId, number, status });
            await client.query(
              'INSERT INTO random_numbers (user_id, number, status) VALUES ($1, $2, $3)',
              [userDbId, number, status]
            );
            console.log('✅ Record inserted successfully');

            // Commit transaction
            await client.query('COMMIT');
            console.log('✅ Transaction committed');

            // Update UI
            await bot.editMessageText(`You marked **${number}** as _${status}_.`, {
              chat_id: msg.chat.id,
              message_id: msg.message_id,
              parse_mode: 'Markdown'
            });
            console.log('✅ UI updated successfully');

          } else {
            await client.query('ROLLBACK');
            console.log('❌ User not found, transaction rolled back');

            await bot.editMessageText(`Could not find your user data. Please try /start again.`, {
              chat_id: msg.chat.id,
              message_id: msg.message_id,
            });
          }
        } catch (dbErr) {
          console.error("❌ Database error:", dbErr);
          if (client) {
            try {
              await client.query('ROLLBACK');
              console.log('🔄 Transaction rolled back');
            } catch (rollbackErr) {
              console.error("❌ Rollback error:", rollbackErr);
            }
          }

          await bot.editMessageText(`Database error: ${dbErr.message}. Please try again.`, {
            chat_id: msg.chat.id,
            message_id: msg.message_id,
          });
        } finally {
          if (client) {
            client.release();
            console.log('🔌 Database connection released');
          }
        }
      } else {
        console.log('❓ Unknown callback data:', data);
      }
    } catch (err) {
      console.error("❌ Failed to process callback query:", err);
      try {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "Sorry, something went wrong. Please try again.",
          show_alert: true
        });
      } catch (ackErr) {
        console.error("❌ Failed to acknowledge callback:", ackErr);
      }
    }
  });
} else {
  console.error('❌ TELEGRAM_BOT_TOKEN is not set. The bot will not work.');
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