import fs from "fs";
import path from "path";

export type ForceJoinChannel = {
  id: string;
  label: string;
  url: string;
  emojiId: string;
};

const CHANNELS_FILE = path.join(process.cwd(), "channels.json");

export const DEFAULT_FORCE_JOIN_CHANNELS: ForceJoinChannel[] = [
  { id: "@indiagates", label: "ANNEBELLA", url: "https://t.me/indiagates", emojiId: "5372849966689566579" },
  { id: "@annebellapanel", label: "PANEL UPDATES", url: "https://t.me/annebellapanel", emojiId: "6035152649790164056" },
  { id: "@AnnebellaStorechat", label: "SUPPORT", url: "https://t.me/AnnebellaStorechat", emojiId: "6026056450223116307" },
  { id: "@AnneBellaForums", label: "FORUM", url: "https://t.me/AnneBellaForums", emojiId: "6203750195130274981" },
];

function normalizeChannel(raw: Partial<ForceJoinChannel>): ForceJoinChannel | null {
  const id = String(raw.id || "").trim();
  const label = String(raw.label || "").trim();
  const url = String(raw.url || "").trim();
  const emojiId = String(raw.emojiId || "5372849966689566579").trim();
  if (!id || !label || !url) return null;
  return { id, label, url, emojiId };
}

export function loadForceJoinChannels(): ForceJoinChannel[] {
  try {
    if (fs.existsSync(CHANNELS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CHANNELS_FILE, "utf-8"));
      if (Array.isArray(parsed)) {
        const channels = parsed
          .map((channel) => normalizeChannel(channel))
          .filter((channel): channel is ForceJoinChannel => Boolean(channel));
        if (channels.length) return channels;
      }
    }
  } catch {
    // Fall back to defaults when the editable file is temporarily invalid.
  }
  return DEFAULT_FORCE_JOIN_CHANNELS;
}

export function saveForceJoinChannels(channels: ForceJoinChannel[]): void {
  fs.writeFileSync(CHANNELS_FILE, JSON.stringify(channels.map(normalizeChannel).filter(Boolean), null, 2));
}

export function upsertForceJoinChannel(input: Partial<ForceJoinChannel>, previousId?: string): ForceJoinChannel[] {
  const channel = normalizeChannel(input);
  if (!channel) throw new Error("id, label and url are required");

  const channels = loadForceJoinChannels();
  const targetId = previousId || channel.id;
  const index = channels.findIndex((item) => item.id === targetId);
  const duplicate = channels.find((item, itemIndex) => item.id === channel.id && itemIndex !== index);
  if (duplicate) throw new Error("Channel already exists");

  if (index >= 0) channels[index] = channel;
  else channels.push(channel);

  saveForceJoinChannels(channels);
  return channels;
}
