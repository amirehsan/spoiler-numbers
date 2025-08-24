export async function POST(request) {
  try {
    const body = await request.json();
    console.log('📨 Webhook received:', JSON.stringify(body, null, 2));

    // Immediate response to Telegram
    return new Response(JSON.stringify({
      ok: true,
      message: 'received',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return new Response(JSON.stringify({
      ok: false,
      error: error.message
    }), {
      status: 200, // Still return 200 to prevent Telegram retries
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

export async function GET(request) {
  return new Response(JSON.stringify({
    message: 'Telegram webhook endpoint is working',
    method: 'POST required',
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}