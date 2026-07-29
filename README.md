# LTW Hub

**Your local creator command center.** LTW Hub connects the LearningTheWires tool suite into one desktop workspace for projects, media workflows, tool launching, and background jobs.

Everything is designed to stay on your machine. Hub does not upload media, require an account, or enable cloud sync.

## Download

Open the [latest release](https://github.com/Eli-Dolney/LTW_Hub/releases/latest) and download the installer for your computer:

- **macOS:** download the `.dmg`, drag LTW Hub into Applications, then right-click it and choose **Open** the first time.
- **Windows:** download the `.exe` installer. If Windows SmartScreen appears, choose **More info → Run anyway**.

The early builds are not code-signed yet, which is why the operating system may show that warning.

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
- First-run Setup Manager with selectable tool installation
- Checks for Git, Python 3.12+, Node.js, and FFmpeg
- Safe one-click requirement installation through Homebrew or Windows Package Manager
- One-click tool updates and dependency repair
- Visible setup progress and actionable errors
- Protection against overwriting locally modified tool repositories
- Dedicated writable Numba cache and offline reuse of downloaded Chatterbox models
- Local project and preference persistence
- Queue and tool-management views
- Small native Tauri backend with allowlisted commands
- Approximately 11 MB packaged macOS application

## Use the Setup Manager

1. Open **Setup** in the sidebar.
2. Install any missing computer requirements.
3. Choose the LTW tools you want.
4. Select **Install selected**.
5. Leave Hub open while large AI and audio packages download.
6. Launch ready tools from **Tools** or the Home screen.

By default, new tools are installed under `~/Documents/LTW Tools`. You can choose another parent folder before installing. Every Python tool gets its own isolated environment, and EzEdit gets its own Node packages.

**Update** downloads the newest public code and refreshes dependencies. It stops safely if a repository contains local code changes. **Repair** refreshes dependencies without deleting the repository, projects, media, voices, or models.

## Build LTW Hub from source

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
~/Documents/LTW Tools
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

## Privacy and safety

- Hub clones only the five fixed public LTW repository URLs listed above.
- Setup commands use argument lists rather than pasted shell commands.
- Python packages are isolated per tool.
- Hub never deletes an existing tool folder during install, update, or repair.
- Updates refuse to run over local tracked-code changes.
- Media, voices, models, exports, cookies, and projects are excluded from this repository.
- Tool processes and their outputs remain on the user's computer.

## Releases

GitHub Actions verifies the React and Rust code on macOS and Windows. Version tags build public `.dmg` and `.exe` downloads automatically. Code signing and automatic Hub self-updates can be added after signing certificates are available.

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
6. Add signed releases and automatic Hub self-updates.

## License

[MIT](LICENSE)
