import { stripMentionsText, TokenCredentials } from "@microsoft/teams.api";
import { App } from "@microsoft/teams.apps";
import { LocalStorage } from "@microsoft/teams.common";
import config from "./config";
import { ManagedIdentityCredential } from "@azure/identity";

import { askAI } from "./src/openai";
import {
  appendL0Event,
  readRecentL0Events,
  formatRecentMemory,
  filterByTime,
} from "./src/memory";

// -----------------------------
// Memory policy (Phase 1)
// -----------------------------
const MEMORY_MAX_ENTRIES = 10; // last N messages
const MEMORY_MAX_DAYS = 2;     // last X days

// -----------------------------
// Storage for local counters only
// -----------------------------
const storage = new LocalStorage();

const createTokenFactory = () => {
  return async (scope: string | string[], tenantId?: string): Promise<string> => {
    const managedIdentityCredential = new ManagedIdentityCredential({
      clientId: process.env.CLIENT_ID,
    });
    const scopes = Array.isArray(scope) ? scope : [scope];
    const tokenResponse = await managedIdentityCredential.getToken(scopes, { tenantId });
    return tokenResponse.token;
  };
};

const tokenCredentials: TokenCredentials = {
  clientId: process.env.CLIENT_ID || "",
  token: createTokenFactory(),
};

const credentialOptions =
  config.MicrosoftAppType === "UserAssignedMsi"
    ? { ...tokenCredentials }
    : undefined;

const app = new App({
  ...credentialOptions,
  storage,
});

interface ConversationState {
  count: number;
}

const getConversationState = (conversationId: string): ConversationState => {
  let state = storage.get(conversationId);
  if (!state) {
    state = { count: 0 };
    storage.set(conversationId, state);
  }
  return state;
};

// ===================================================
// MAIN MESSAGE HANDLER
// ===================================================
app.on("message", async (context) => {
  const activity = context.activity;
  const text = stripMentionsText(activity).trim();
  const conversationId = activity.conversation.id;
  const fromName = activity.from?.name;

  if (!text) {
    await context.send("Please mention me with a message.");
    return;
  }

  // Local counter (not memory)
  const state = getConversationState(conversationId);
  state.count++;

  let recentMemory = "No prior messages in scope.";
  let aiReply = "";

  try {
    // -------------------------------------------------
    // 1) READ L0 MEMORY (auto memory)
    // -------------------------------------------------
    const rawEvents = await readRecentL0Events(
      conversationId,
      MEMORY_MAX_ENTRIES * 2
    );

    const timeFiltered = filterByTime(rawEvents, MEMORY_MAX_DAYS);
    const limited = timeFiltered.slice(-MEMORY_MAX_ENTRIES);
    recentMemory = formatRecentMemory(limited);

    // -------------------------------------------------
    // 2) ASK AI (with memory)
    // -------------------------------------------------
    aiReply = await askAI({
      userMessage: text,
      projectState: "Project is in initial PoC phase.",
      teamRoles: "User is a team member.",
      rules: "Provide clear, structured updates. Follow project rules.",
      recentMemory,
    });

    await context.send(aiReply);

  } catch (err) {
    console.error("AI ERROR:", err);
    await context.send("⚠️ Error calling AI.");
    return;
  }

  // -------------------------------------------------
  // 3) WRITE L0 EVENTS (audit log)
  // -------------------------------------------------
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
  } catch (logErr) {
    console.error("L0 LOGGING ERROR:", logErr);
    // Do NOT block response
  }
});

export default app;
