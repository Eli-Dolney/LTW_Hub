import type { Project, QueueItem, Tool } from "./types";

export const INITIAL_TOOLS: Tool[] = [
  {
    id: "downloader",
    name: "LTW Downloader",
    shortName: "DL",
    description: "Capture source video and audio at the best available quality.",
    category: "Capture",
    color: "#50e3c2",
    installed: false,
  },
  {
    id: "clipper",
    name: "LTW Clipper",
    shortName: "CL",
    description: "Find highlights, reframe footage, and build captioned social clips.",
    category: "Video",
    color: "#9b7cff",
    installed: false,
  },
  {
    id: "audio",
    name: "LTW Audio",
    shortName: "AU",
    description: "Separate stems, analyze songs, and generate remix-ready patterns.",
    category: "Audio",
    color: "#ffb84d",
    installed: false,
  },
  {
    id: "editor",
    name: "LTW EzEdit",
    shortName: "EZ",
    description: "Create thumbnails, graphics, and platform-ready artwork.",
    category: "Design",
    color: "#ff6f91",
    installed: false,
  },
  {
    id: "tts",
    name: "LTW Voice",
    shortName: "VO",
    description: "Generate local voice-over and expressive narration.",
    category: "Voice",
    color: "#62a8ff",
    installed: false,
  },
];

export const SEED_PROJECTS: Project[] = [
  {
    id: "demo-1",
    title: "Building a Local AI Studio",
    type: "Shorts package",
    status: "Processing",
    progress: 68,
    updatedAt: "12 minutes ago",
    sourceCount: 4,
    accent: "violet",
  },
  {
    id: "demo-2",
    title: "July Creator Recap",
    type: "Long-form video",
    status: "Ready",
    progress: 100,
    updatedAt: "Yesterday",
    sourceCount: 12,
    accent: "cyan",
  },
  {
    id: "demo-3",
    title: "Midnight Circuit Remix",
    type: "Audio remix",
    status: "Draft",
    progress: 24,
    updatedAt: "3 days ago",
    sourceCount: 2,
    accent: "amber",
  },
];

export const SEED_QUEUE: QueueItem[] = [
  {
    id: "queue-1",
    title: "Generate 6 vertical clips",
    detail: "Building a Local AI Studio",
    tool: "LTW Clipper",
    progress: 68,
    status: "Running",
  },
  {
    id: "queue-2",
    title: "Create thumbnail variants",
    detail: "Building a Local AI Studio",
    tool: "LTW EzEdit",
    progress: 0,
    status: "Waiting",
  },
];
