import { Router, type IRouter } from "express";
import {
  loadForceJoinChannels,
  saveForceJoinChannels,
  upsertForceJoinChannel,
} from "../lib/forceJoinChannels";

const router: IRouter = Router();

router.get("/channels", (_req, res) => {
  res.json(loadForceJoinChannels());
});

router.post("/channels", (req, res) => {
  try {
    res.status(201).json(upsertForceJoinChannel(req.body));
  } catch (err) {
    res.status(err instanceof Error && err.message.includes("exists") ? 409 : 400).json({
      error: err instanceof Error ? err.message : "Unable to save channel",
    });
  }
});

router.patch("/channels/:id", (req, res) => {
  try {
    res.json(upsertForceJoinChannel(req.body, decodeURIComponent(req.params.id)));
  } catch (err) {
    res.status(err instanceof Error && err.message.includes("exists") ? 409 : 400).json({
      error: err instanceof Error ? err.message : "Unable to update channel",
    });
  }
});

router.delete("/channels/:id", (req, res) => {
  const id = decodeURIComponent(req.params.id);
  const channels = loadForceJoinChannels().filter(c => c.id !== id);
  saveForceJoinChannels(channels);
  res.json(channels);
});

export default router;
