import "dotenv/config";
import express from "express";
import { BotFrameworkAdapter, TurnContext } from "botbuilder";
import { AIPMBot } from "./src/bot";

const app = express();
app.use(express.json());

// Bot Framework Adapter (uses App Registration credentials)
const adapter = new BotFrameworkAdapter({
  appId: process.env.MICROSOFT_APP_ID,
  appPassword: process.env.MICROSOFT_APP_PASSWORD,
});

adapter.onTurnError = async (context: TurnContext, error: any) => {
  console.error("BOT ERROR:", error);
  await context.sendActivity("⚠️ The bot hit an error.");
};

const bot = new AIPMBot();

app.get("/", (req, res) => {
  res.send("Bot is running ✅");
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Messages endpoint (Teams/Azure Bot will POST here)
app.post("/api/messages", (req, res) => {
  adapter.processActivity(req, res, async (context) => {
    await bot.run(context);
  });
});

const port = Number(process.env.PORT || 3978);
app.listen(port, () => console.log(`Bot listening on port ${port}`));