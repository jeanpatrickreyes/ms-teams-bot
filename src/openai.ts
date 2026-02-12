// src/openai.ts
import OpenAI from "openai";
import "dotenv/config";
import { buildSystemPrompt } from "./prompt";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function askAI(input: {
  userMessage: string;
  projectState?: string;
  teamRoles?: string;
  rules?: string;
  recentMemory?: string;
}) {
  try {
    const systemPrompt = buildSystemPrompt({
      projectState: input.projectState,
      teamRoles: input.teamRoles,
      rules: input.rules,
      recentMemory: input.recentMemory,
    });

    const model = process.env.AI_MODEL || "gpt-4.1-mini";

    const response = await client.responses.create({
      model,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: input.userMessage },
      ],
    });

    return response.output_text || "(empty response)";
  } catch (err) {
    console.error("OPENAI ERROR:", err);
    throw err;
  }
}
