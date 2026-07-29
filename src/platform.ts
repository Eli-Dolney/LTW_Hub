import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
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

export interface RequirementStatus {
  id: string;
  name: string;
  available: boolean;
  version: string;
  requiredBy: string[];
  installHint: string;
  canInstall: boolean;
}

export interface ToolSetupStatus {
  id: string;
  installed: boolean;
  configured: boolean;
  path: string;
  revision: string;
  hasLocalChanges: boolean;
}

export interface SetupSnapshot {
  root: string;
  requirements: RequirementStatus[];
  tools: ToolSetupStatus[];
}

export interface SetupProgress {
  toolId: string;
  action: string;
  stage: string;
  message: string;
  percent: number;
}

export interface SetupResult {
  ok: boolean;
  message: string;
}

export type SetupAction = "install" | "update" | "repair";

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

  async setupSnapshot(root?: string): Promise<SetupSnapshot> {
    if (!isTauri) {
      return {
        root: root ?? "~/Documents/LTW Tools",
        requirements: [
          {
            id: "git",
            name: "Git",
            available: true,
            version: "git version 2.50.1",
            requiredBy: ["Tool installation and updates"],
            installHint: "",
            canInstall: false,
          },
          {
            id: "python",
            name: "Python 3.12+",
            available: true,
            version: "Python 3.12.11",
            requiredBy: ["Downloader", "Clipper", "Audio", "Voice"],
            installHint: "",
            canInstall: false,
          },
          {
            id: "node",
            name: "Node.js",
            available: true,
            version: "v22.17.0",
            requiredBy: ["Downloader", "EzEdit"],
            installHint: "",
            canInstall: false,
          },
          {
            id: "ffmpeg",
            name: "FFmpeg",
            available: false,
            version: "",
            requiredBy: ["Downloader", "Clipper", "Audio", "Voice"],
            installHint: "Homebrew: brew install ffmpeg",
            canInstall: true,
          },
        ],
        tools: ["downloader", "clipper", "audio", "editor", "tts"].map((id) => ({
          id,
          installed: false,
          configured: false,
          path: `${root ?? "~/Documents/LTW Tools"}/${id}`,
          revision: "",
          hasLocalChanges: false,
        })),
      };
    }
    return invoke<SetupSnapshot>("setup_snapshot", { toolsRoot: root ?? null });
  },

  async manageTool(id: string, action: SetupAction, root?: string): Promise<SetupResult> {
    if (!isTauri) {
      return { ok: false, message: "Tool setup is available in the desktop app." };
    }
    return invoke<SetupResult>("manage_tool", {
      id,
      action,
      toolsRoot: root ?? null,
    });
  },

  async installRequirement(id: string): Promise<SetupResult> {
    if (!isTauri) {
      return { ok: false, message: "Requirement setup is available in the desktop app." };
    }
    return invoke<SetupResult>("install_requirement", { id });
  },

  async onSetupProgress(
    handler: (progress: SetupProgress) => void,
  ): Promise<UnlistenFn | undefined> {
    if (!isTauri) return undefined;
    return listen<SetupProgress>("setup-progress", (event) => handler(event.payload));
  },

  async openPath(targetPath: string): Promise<string> {
    if (!isTauri) return "Path opening is available in the desktop app.";
    return invoke<string>("open_path", { targetPath });
  },
};
