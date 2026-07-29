/// <reference types="vite/client" />

interface ToolDetection {
  id: string;
  installed: boolean;
  path: string;
}

interface Window {
  ltwHub?: {
    detectTools: (root?: string) => Promise<ToolDetection[]>;
    chooseToolsRoot: () => Promise<string | null>;
    chooseMedia: () => Promise<string[]>;
    launchTool: (id: string, root?: string) => Promise<{ ok: boolean; message: string }>;
    openPath: (path: string) => Promise<string>;
  };
}
