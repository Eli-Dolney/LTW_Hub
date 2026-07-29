import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export interface ToolDetection {
  id: string;
  installed: boolean;
  path: string;
}

export interface LaunchResult {
  ok: boolean;
  message: string;
}

const isTauri = "__TAURI_INTERNALS__" in window;

export const desktopApi = {
  isAvailable: isTauri,

  async detectTools(root?: string): Promise<ToolDetection[]> {
    if (!isTauri) return [];
    return invoke<ToolDetection[]>("detect_tools", { toolsRoot: root ?? null });
  },

  async chooseToolsRoot(): Promise<string | null> {
    if (!isTauri) return null;
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Choose the folder containing your LTW tools",
    });
    return typeof selected === "string" ? selected : null;
  },

  async chooseMedia(): Promise<string[]> {
    if (!isTauri) return [];
    const selected = await open({
      multiple: true,
      title: "Add source media",
      filters: [
        {
          name: "Media",
          extensions: ["mp4", "mov", "mkv", "webm", "mp3", "wav", "m4a", "flac"],
        },
      ],
    });
    if (!selected) return [];
    return Array.isArray(selected) ? selected : [selected];
  },

  async launchTool(id: string, root?: string): Promise<LaunchResult> {
    if (!isTauri) {
      return { ok: false, message: "Tool launching is available in the desktop app." };
    }
    return invoke<LaunchResult>("launch_tool", { id, toolsRoot: root ?? null });
  },

  async openPath(targetPath: string): Promise<string> {
    if (!isTauri) return "Path opening is available in the desktop app.";
    return invoke<string>("open_path", { targetPath });
  },
};
