// src/context.ts
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

async function readTextSafe(filePath: string, fallback = "N/A") {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return fallback;
  }
}

async function readJsonSafe(filePath: string, fallback: any = {}) {
  try {
    const txt = await fs.readFile(filePath, "utf8");
    return JSON.parse(txt);
  } catch {
    return fallback;
  }
}

export async function loadContext() {
  const govDir = path.join(DATA_DIR, "00_GOVERNANCE");
  const stateDir = path.join(DATA_DIR, "01_PROJECT_STATE");

  const ruleset = await readTextSafe(path.join(govDir, "Ruleset.md"));
  const leadership = await readTextSafe(path.join(govDir, "Leadership_Guidelines.md"));
  const charter = await readTextSafe(path.join(govDir, "Project_Charter.md"));

  const projectStateObj = await readJsonSafe(path.join(stateDir, "ProjectState.json"), {});
  const teamRolesObj = await readJsonSafe(path.join(stateDir, "TeamRoles.json"), {});
  const decisionsObj = await readJsonSafe(path.join(stateDir, "Decisions_Log.json"), { decisions: [] });
  const issuesObj = await readJsonSafe(path.join(stateDir, "Open_Issues.json"), { issues: [] });

  return {
    rulesText: [ruleset, leadership, charter].join("\n\n---\n\n"),
    projectStateText: JSON.stringify(projectStateObj, null, 2),
    teamRolesText: JSON.stringify(teamRolesObj, null, 2),
    decisionsText: JSON.stringify(decisionsObj, null, 2),
    issuesText: JSON.stringify(issuesObj, null, 2),
  };
}
