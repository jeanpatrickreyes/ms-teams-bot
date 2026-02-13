import { ActivityHandler, TurnContext } from "botbuilder";
import { askAI } from "./openai";
import {
  appendL0Event,
  readRecentL0Events,
  formatRecentMemory,
  filterByTime,
} from "./memory";

const MEMORY_MAX_ENTRIES = 10;
const MEMORY_MAX_DAYS = 2;

export class TeamsBot extends ActivityHandler {
  constructor() {
    super();

    this.onMessage(async (context, next) => {
      const text = context.activity.text?.trim();
      const conversationId = context.activity.conversation.id;
      const fromName = context.activity.from?.name;

      if (!text) {
        await context.sendActivity("Please send a message.");
        return;
      }

      let recentMemory = "No prior messages in scope.";

      try {
        const rawEvents = await readRecentL0Events(
          conversationId,
          MEMORY_MAX_ENTRIES * 2
        );

        const timeFiltered = filterByTime(rawEvents, MEMORY_MAX_DAYS);
        const limited = timeFiltered.slice(-MEMORY_MAX_ENTRIES);
        recentMemory = formatRecentMemory(limited);

        const aiReply = await askAI({
          userMessage: text,
          projectState: "Project is in initial PoC phase.",
          teamRoles: "User is a team member.",
          rules: "Provide structured updates.",
          recentMemory,
        });

        await context.sendActivity(aiReply);

        await appendL0Event({
          type: "user_message",
          conversationId,
          from: { name: fromName },
          text,
        });

        await appendL0Event({
          type: "bot_reply",
          conversationId,
          from: { name: "Bot" },
          text: aiReply,
          model: process.env.AI_MODEL,
        });

      } catch (err) {
        console.error(err);
        await context.sendActivity("Error processing request.");
      }

      await next();
    });
  }
}