import { Router, type IRouter } from "express";
import fs from "fs";
import path from "path";

const router: IRouter = Router();
const CHANNELS_FILE = path.join(process.cwd(), "channels.json");

const DEFAULT_CHANNELS = [
  { id: "@indiagates",         label: "AnneBella Network", url: "https://t.me/indiagates" },
  { id: "@annebellapanel",     label: "Panel Update",       url: "https://t.me/annebellapanel" },
  { id: "@AnnebellaStorechat", label: "Support Group",      url: "https://t.me/AnnebellaStorechat" },
  { id: "@AnneBellaForums",    label: "Forum",              url: "https://t.me/AnneBellaForums" },
];

export function loadChannels(): typeof DEFAULT_CHANNELS {
  try {
    if (fs.existsSync(CHANNELS_FILE)) {
      return JSON.parse(fs.readFileSync(CHANNELS_FILE, "utf-8"));
    }
  } catch {}
  return DEFAULT_CHANNELS;
}

function saveChannels(channels: typeof DEFAULT_CHANNELS) {
  fs.writeFileSync(CHANNELS_FILE, JSON.stringify(channels, null, 2));
}

router.get("/channels", (_req, res) => {
  res.json(loadChannels());
});

router.post("/channels", (req, res) => {
  const { id, label, url } = req.body;
  if (!id || !label || !url) {
    res.status(400).json({ error: "id, label, url required" });
    return;
  }
  const channels = loadChannels();
  if (channels.find(c => c.id === id)) {
    res.status(409).json({ error: "Channel already exists" });
    return;
  }
  channels.push({ id, label, url });
  saveChannels(channels);
  res.status(201).json(channels);
});

router.delete("/channels/:id", (req, res) => {
  const id = decodeURIComponent(req.params.id);
  const channels = loadChannels().filter(c => c.id !== id);
  saveChannels(channels);
  res.json(channels);
});

export default router;
