import { mkdirSync } from "node:fs";
import { join } from "node:path";

import Database from "better-sqlite3";

export type TaskVisibility = "PUBLIC" | "PRIVATE";

export interface TaskRecord {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  creatorId: string;
  projectId: string;
  visibility: TaskVisibility;
  clientTempId: string | null;
  createdAt: string;
}

const dataDir = join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

export const db = new Database(join(dataDir, "river-control-center.sqlite"));

db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT NOT NULL DEFAULT 'medium',
    assigneeId TEXT,
    creatorId TEXT NOT NULL,
    projectId TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'PUBLIC',
    clientTempId TEXT,
    createdAt TEXT NOT NULL
  )
`);
