import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();
let ready = false;

type TaskRow = {
  id: number;
  title: string;
  description: string | null;
  url: string;
  reward_credits: number;
  task_type: string;
  is_active: boolean;
  created_at: Date;
};

async function ensureTaskStorage(): Promise<void> {
  if (ready) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_tasks (
      id serial PRIMARY KEY,
      title text NOT NULL,
      description text,
      url text NOT NULL,
      reward_credits integer NOT NULL DEFAULT 0,
      task_type text NOT NULL DEFAULT 'channel',
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  ready = true;
}

function serialize(row: TaskRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    url: row.url,
    rewardCredits: row.reward_credits,
    taskType: row.task_type,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
  };
}

router.get("/tasks", async (req, res): Promise<void> => {
  await ensureTaskStorage();
  const activeOnly = req.query.active === "1";
  const result = await pool.query<TaskRow>(
    `SELECT * FROM app_tasks ${activeOnly ? "WHERE is_active = true" : ""} ORDER BY created_at DESC`,
  );
  res.json(result.rows.map(serialize));
});

router.post("/tasks", async (req, res): Promise<void> => {
  await ensureTaskStorage();
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
  const url = typeof req.body?.url === "string" ? req.body.url.trim() : "";
  const taskType = typeof req.body?.taskType === "string" ? req.body.taskType.trim() : "channel";
  const rewardCredits = Number(req.body?.rewardCredits || 0);
  if (!title || !url || !/^https?:\/\/.+/i.test(url)) {
    res.status(400).json({ error: "Valid title and URL are required" });
    return;
  }
  const result = await pool.query<TaskRow>(
    `INSERT INTO app_tasks (title, description, url, reward_credits, task_type, is_active)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING *`,
    [title, description || null, url, Number.isFinite(rewardCredits) ? Math.max(0, rewardCredits) : 0, taskType || "channel"],
  );
  const task = result.rows[0];
  if (!task) {
    res.status(500).json({ error: "Task create failed" });
    return;
  }
  res.status(201).json(serialize(task));
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  await ensureTaskStorage();
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid task ID" });
    return;
  }
  const isActive = Boolean(req.body?.isActive);
  const result = await pool.query<TaskRow>(
    `UPDATE app_tasks SET is_active = $1 WHERE id = $2 RETURNING *`,
    [isActive, id],
  );
  const task = result.rows[0];
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(serialize(task));
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  await ensureTaskStorage();
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid task ID" });
    return;
  }
  const result = await pool.query(`DELETE FROM app_tasks WHERE id = $1 RETURNING id`, [id]);
  if (!result.rows[0]) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
