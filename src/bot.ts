import { TeamsActivityHandler, TurnContext } from "botbuilder";
import { askAI } from "./openai";
import { loadContext } from "./context";
import { appendL0Event, readRecentL0Events, filterByTime, formatRecentMemory } from "./memory";

const MEMORY_MAX_ENTRIES = 10;
const MEMORY_MAX_DAYS = 2;

function stripMentions(text: string) {
  // simple cleanup; Teams mentions often come through as <at>...</at>
  return (text || "").replace(/<at>.*?<\/at>/g, "").trim();
}

export class AIPMBot extends TeamsActivityHandler {
  constructor() {
    super();

    this.onMessage(async (context, next) => {
      const rawText = context.activity.text ?? "";
      const text = stripMentions(rawText);
      const conversationId = context.activity.conversation?.id ?? "unknown";
      const fromName = context.activity.from?.name ?? "User";

      if (!text) {
        await context.sendActivity("Please mention me with a message.");
        await next();
        return;
      }

      // 1) Load governance/state files
      const ctx = await loadContext();

      // 2) Read L0 memory (last N, last X days, channel scoped by conversationId)
      const rawEvents = await readRecentL0Events(conversationId, MEMORY_MAX_ENTRIES * 2);
      const timeFiltered = filterByTime(rawEvents, MEMORY_MAX_DAYS);
      const limited = timeFiltered.slice(-MEMORY_MAX_ENTRIES);
      const recentMemory = formatRecentMemory(limited);

      // 3) Ask AI with injected prompt context
      const aiReply = await askAI({
        userMessage: text,
        projectState: ctx.projectStateText,
        teamRoles: ctx.teamRolesText,
        rules: ctx.rulesText,
        recentMemory,
      });

      await context.sendActivity(aiReply);

      // 4) Write L0 audit log (append-only JSON files)
      try {
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
      } catch (e) {
        console.error("L0 LOGGING ERROR:", e);
      }

      await next();
    });
  }
}