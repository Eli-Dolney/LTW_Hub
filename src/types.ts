export type View = "dashboard" | "setup" | "projects" | "tools" | "queue" | "settings";

export interface Project {
  id: string;
  title: string;
  type: "Shorts package" | "Long-form video" | "Audio remix" | "Quick edit";
  status: "Ready" | "Processing" | "Draft";
  progress: number;
  updatedAt: string;
  sourceCount: number;
  accent: "violet" | "cyan" | "amber" | "rose";
}

export interface QueueItem {
  id: string;
  title: string;
  detail: string;
  tool: string;
  progress: number;
  status: "Running" | "Waiting" | "Complete";
}

export interface Tool {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: string;
  color: string;
  installed: boolean;
  path?: string;
}
