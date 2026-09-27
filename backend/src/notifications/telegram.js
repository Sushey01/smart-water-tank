export async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const chatId = process.env.TELEGRAM_CHAT_ID || "";
  if (!token || !chatId) {
    return { attempted: false, delivered: false, error: "" };
  }
  if (!token.includes(":")) {
    return {
      attempted: false,
      delivered: false,
      error: "Bot token must be the full BotFather value, including the number and colon.",
    };
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const body = await response.json();
    if (!body.ok) {
      return { attempted: true, delivered: false, error: body.description || "Telegram request failed" };
    }
    return { attempted: true, delivered: true, error: "" };
  } catch (error) {
    return { attempted: true, delivered: false, error: error.message };
  }
}
