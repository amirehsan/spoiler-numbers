import TelegramBot from 'node-telegram-bot-api';
import pool from '../../../lib/db';

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('📨 Webhook received:', JSON.stringify(body, null, 2));

    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

    // Handle /start command
    if (body.message && body.message.text === '/start') {
      console.log('🚀 Processing /start command');

      const { id, username, first_name, last_name } = body.message.from;
      const chatId = body.message.chat.id;

      try {
        // Send response immediately
        await bot.sendMessage(chatId, 'Welcome! Click the button to get a random number.', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Random Number', callback_data: 'random_number' }]
            ]
          }
        });
        console.log('✅ Welcome message sent');

        // Register user synchronously (but quickly)
        let client;
        try {
          client = await Promise.race([
            pool.connect(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('DB timeout')), 3000))
          ]);

          const res = await client.query('SELECT * FROM users WHERE telegram_id = $1', [id]);
          if (res.rows.length === 0) {
            await client.query(
              'INSERT INTO users (telegram_id, username, first_name, last_name) VALUES ($1, $2, $3, $4)',
              [id, username, first_name, last_name]
            );
            console.log('✅ User registered in database');
          }
        } catch (err) {
          console.error('❌ User registration error:', err);
        } finally {
          if (client) client.release();
        }

      } catch (botError) {
        console.error('❌ Error sending welcome message:', botError);
      }
    }

    // Handle callback queries (button clicks)
    if (body.callback_query) {
      console.log('🔄 Processing callback query:', body.callback_query.data);

      const callbackQuery = body.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;
      const data = callbackQuery.data;
      const userId = callbackQuery.from.id;

      try {
        // Acknowledge callback immediately
        await bot.answerCallbackQuery(callbackQuery.id);
        console.log('✅ Callback acknowledged');

        if (data === 'random_number') {
          console.log('🎲 Generating random number');

          const randomNumber = Math.floor(Math.random() * 37);

          await bot.sendMessage(chatId, `||${randomNumber}||`, {
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
          console.log('✅ Random number sent:', randomNumber);

        } else if (data.startsWith('check_') || data.startsWith('uncheck_')) {
          console.log('💾 Processing check/uncheck action');

          const [action, numberStr] = data.split('_');
          const number = parseInt(numberStr, 10);
          const status = action === 'check' ? 'checked' : 'not-checked';

          console.log('📊 Action details:', { userId, number, status, action });

          // Database operations FIRST (synchronously)
          let client;
          let dbSuccess = false;

          try {
            console.log('🔗 Getting database connection...');
            client = await Promise.race([
              pool.connect(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000))
            ]);
            console.log('✅ Database connected');

            // Start explicit transaction
            await client.query('BEGIN');
            console.log('🔄 Transaction started');

            // Find or create user
            let userRes = await client.query('SELECT id FROM users WHERE telegram_id = $1', [userId]);
            console.log('👤 User lookup result:', userRes.rows.length > 0 ? `Found ID: ${userRes.rows[0]?.id}` : 'Not found');

            if (userRes.rows.length === 0) {
              console.log('👤 Creating new user...');
              await client.query(
                'INSERT INTO users (telegram_id, username, first_name, last_name) VALUES ($1, $2, $3, $4)',
                [userId, callbackQuery.from.username, callbackQuery.from.first_name, callbackQuery.from.last_name]
              );
              userRes = await client.query('SELECT id FROM users WHERE telegram_id = $1', [userId]);
              console.log('✅ User created with ID:', userRes.rows[0]?.id);
            }

            if (userRes.rows.length > 0) {
              const userDbId = userRes.rows[0].id;
              console.log('💾 Inserting record:', { userDbId, number, status });

              const insertResult = await client.query(
                'INSERT INTO random_numbers (user_id, number, status) VALUES ($1, $2, $3) RETURNING *',
                [userDbId, number, status]
              );

              console.log('✅ Record inserted:', insertResult.rows[0]);

              // Commit transaction
              await client.query('COMMIT');
              console.log('✅ Transaction committed successfully');
              dbSuccess = true;

              // Verify the insert
              const verifyResult = await client.query(
                'SELECT * FROM random_numbers WHERE user_id = $1 AND number = $2 AND status = $3 ORDER BY created_at DESC LIMIT 1',
                [userDbId, number, status]
              );
              console.log('🔍 Verification query result:', verifyResult.rows[0]);

            } else {
              await client.query('ROLLBACK');
              console.log('❌ No user found, transaction rolled back');
            }

          } catch (dbErr) {
            console.error('❌ Database error:', dbErr);
            if (client) {
              try {
                await client.query('ROLLBACK');
                console.log('🔄 Transaction rolled back due to error');
              } catch (rollbackErr) {
                console.error('❌ Rollback error:', rollbackErr);
              }
            }
          } finally {
            if (client) {
              client.release();
              console.log('🔌 Database connection released');
            }
          }

          // Update UI after database operation
          try {
            const message = dbSuccess
              ? `You marked **${number}** as _${status}_. ✅ Saved to database!`
              : `You marked **${number}** as _${status}_. ❌ Database save failed.`;

            await bot.editMessageText(message, {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: 'Markdown'
            });
            console.log('✅ UI updated with database status');
          } catch (uiError) {
            console.error('❌ UI update error:', uiError);
          }
        }

      } catch (callbackError) {
        console.error('❌ Callback processing error:', callbackError);
      }
    }

    // Always return success to Telegram
    return new Response(JSON.stringify({
      ok: true,
      message: 'processed',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);

    // Still return 200 to prevent Telegram retries
    return new Response(JSON.stringify({
      ok: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

export const maxDuration = 15;