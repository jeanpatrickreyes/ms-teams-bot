import express from "express";
import { BotFrameworkAdapter } from "botbuilder";
import dotenv from "dotenv";
import { TeamsBot } from "./src/bot";

dotenv.config();

const app = express();
app.use(express.json());

const adapter = new BotFrameworkAdapter({
  appId: process.env.CLIENT_ID,
  appPassword: process.env.CLIENT_PASSWORD,
});

adapter.onTurnError = async (context, error) => {
  console.error("Bot error:", error);
  await context.sendActivity("Bot encountered an error.");
};

const bot = new TeamsBot();

app.post("/api/messages", (req, res) => {
  adapter.processActivity(req, res, async (context) => {
    await bot.run(context);
  });
});

const port = process.env.PORT || 3978;
app.listen(port, () => {
  console.log(`Bot running on port ${port}`);
});