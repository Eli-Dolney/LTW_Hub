# LTW Hub

**Your local creator command center.** LTW Hub connects the LearningTheWires tool suite into one desktop workspace for projects, media workflows, tool launching, and background jobs.

Everything is designed to stay on your machine. Hub does not upload media, require an account, or enable cloud sync.

## What is included

This repository contains only the LTW Hub source code and app artwork. It does **not** contain anyone's media, projects, model downloads, credentials, environment files, or private folders.

The creator tools remain separate applications. Install whichever ones you want Hub to launch:

- [LTW Downloader](https://github.com/Eli-Dolney/LTW_Downloader)
- [LTW Clipper](https://github.com/Eli-Dolney/LTW_Clipper)
- [LTW Audio Splitter](https://github.com/Eli-Dolney/LTW_Audio_Spiltter)
- [LTW EzEdit](https://github.com/Eli-Dolney/LTW_EzEdit)
- [LTW Voice / TTS](https://github.com/Eli-Dolney/TTS)

Clone the tools into one parent folder, then choose that parent folder in **Settings → Tools folder**. Each tool has its own dependencies and setup instructions.

## MVP features

- Polished dashboard for recent projects, active jobs, and quick launches
- Project creation for Shorts packages, long-form videos, audio remixes, and quick edits
- Automatic discovery of LTW repositories in common development folders
- Configurable tools folder
- Native launch support for:
  - LTW Downloader
  - LTW Clipper
  - LTW Audio
  - LTW EzEdit
  - LTW Voice / TTS
- Automatic browser opening when the TTS Gradio UI is ready on port 7861
- Dedicated writable Numba cache and offline reuse of downloaded Chatterbox models
- Local project and preference persistence
- Queue and tool-management views
- Small native Tauri backend with allowlisted commands
- Approximately 11 MB packaged macOS application

## Run LTW Hub

Requirements:

- Node.js 20 or newer
- npm
- Rust 1.77.2 or newer
- Xcode Command Line Tools on macOS

```bash
npm install
npm run dev
```

For browser-only interface development:

```bash
npm run dev:web
```

Create a production desktop application:

```bash
npm run build
```

The macOS application is written to:

```text
src-tauri/target/release/bundle/macos/LTW Hub.app
```

Run frontend and native checks:

```bash
npm test
cargo test --manifest-path src-tauri/Cargo.toml
```

## Tool discovery

Without configuration, Hub checks these parent folders:

```text
~/Desktop/Projects
~/Desktop/Python Scripts
~/Documents/GitHub
~/GitHub
~/Developer
~/Projects
~/Documents
```

Hub recognizes the public repository names as well as these legacy folder names:

```text
~/Desktop/Python Scripts/LTW_Downloader
~/Desktop/Python Scripts/LTW_Splitter
~/Desktop/Python Scripts/LTW_Audio
~/Desktop/Projects/LTW Photoshop
~/Desktop/Projects/TTS-MAc/TTS
```

You can choose a different parent folder under **Settings → Tools folder**.

Hub stores preferences and its sample project state in the operating system's local app storage. That data is created separately for each person and is never committed to this repository.

## Current architecture

```text
LTW_Hub/
├── src-tauri/
│   ├── src/tools.rs   # Discovery, launch, local model, and URL behavior
│   ├── src/lib.rs     # Tauri application setup and command registration
│   └── tauri.conf.json
├── src/
│   ├── App.tsx        # Main product interface and views
│   ├── platform.ts    # Typed frontend-to-Tauri bridge
│   ├── data.ts        # Tool catalog and starter project data
│   ├── styles.css     # LTW design system
│   └── types.ts       # Shared application models
└── vite.config.ts
```

The interface is React + TypeScript + Vite. Tauri uses the operating system's native webview, while a small Rust backend handles only allowlisted tool discovery, launching, file opening, and TTS readiness.

## Next milestones

1. Replace the demo queue with a persistent job engine.
2. Add per-project media folders and a shared manifest format.
3. Connect Downloader output directly to Clipper projects.
4. Stream job progress and logs into Hub.
5. Add workflow presets and reusable channel branding.
6. Package signed macOS and Windows installers.

## License

[MIT](LICENSE)
