// src/memory.ts
import { promises as fs } from "fs";
import path from "path";

const BASE_DIR = path.join(process.cwd(), "data", "02_L0_AUDIT_LOG", "events");

export type L0EventType = "user_message" | "bot_reply";

export interface L0Event {
  id: string;
  ts: string; // ISO
  type: L0EventType;
  conversationId: string;
  from?: {
    name?: string;
    aadObjectId?: string;
  };
  text: string;
  model?: string;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function eventPathForDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  return path.join(BASE_DIR, String(yyyy), mm);
}

function makeId(d: Date) {
  // sortable id
  const ts = d.toISOString().replace(/[:.]/g, "-");
  return ts;
}

export async function appendL0Event(e: Omit<L0Event, "id" | "ts">) {
  const d = new Date();
  const dir = eventPathForDate(d);
  await fs.mkdir(dir, { recursive: true });

  const id = makeId(d);
  const ts = d.toISOString();

  const event: L0Event = { id, ts, ...e };

  const fileName = `event_${id}_${event.type}.json`;
  const fullPath = path.join(dir, fileName);

  // append-only: fail if exists (extremely unlikely, but still)
  await fs.writeFile(fullPath, JSON.stringify(event, null, 2), { flag: "wx" });

  return { event, fullPath };
}

async function listJsonFilesRecursive(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const files: string[] = [];
    for (const ent of entries) {
      const p = path.join(root, ent.name);
      if (ent.isDirectory()) {
        files.push(...(await listJsonFilesRecursive(p)));
      } else if (ent.isFile() && ent.name.endsWith(".json") && ent.name.startsWith("event_")) {
        files.push(p);
      }
    }
    return files;
  } catch {
    return [];
  }
}

export async function readRecentL0Events(conversationId: string, limit = 20) {
  const files = await listJsonFilesRecursive(BASE_DIR);
  const events: L0Event[] = [];

  for (const f of files) {
    try {
      const txt = await fs.readFile(f, "utf8");
      const e = JSON.parse(txt) as L0Event;
      if (e.conversationId === conversationId) events.push(e);
    } catch {
      // ignore broken files
    }
  }

  events.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  return events.slice(Math.max(0, events.length - limit));
}

export function formatRecentMemory(events: L0Event[]) {
  if (!events.length) return "No prior messages in scope.";

  // Keep it compact; GPT doesn't need huge logs in Phase 1.
  return events
    .map((e) => {
      const who = e.type === "user_message" ? (e.from?.name ?? "User") : "Bot";
      const t = e.ts;
      const text = e.text.replace(/\s+/g, " ").trim();
      return `- [${t}] ${who}: ${text}`;
    })
    .join("\n");
}

export async function listRecentL0Files(conversationId: string, limit = 5) {
  const events = await readRecentL0Events(conversationId, 200);
  const last = events.slice(Math.max(0, events.length - limit));
  return last.map((e) => `event_${e.id}_${e.type}.json @ ${e.ts}`);
}

export function filterByTime(
  events: L0Event[],
  maxDays: number
): L0Event[] {
  const cutoff = Date.now() - maxDays * 24 * 60 * 60 * 1000;
  return events.filter(e => new Date(e.ts).getTime() >= cutoff);
}

