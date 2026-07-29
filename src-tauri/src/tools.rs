use serde::Serialize;
use std::{
    env,
    ffi::OsString,
    net::{SocketAddr, TcpStream},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolDetection {
    id: String,
    installed: bool,
    path: String,
}

#[derive(Serialize)]
pub struct LaunchResult {
    ok: bool,
    message: String,
}

#[derive(Clone)]
struct CommandSpec {
    program: &'static str,
    args: &'static [&'static str],
}

struct ToolConfig {
    folders: &'static [&'static str],
    macos: &'static [CommandSpec],
    windows: &'static [CommandSpec],
    linux: &'static [CommandSpec],
    web_url: Option<&'static str>,
    needs_numba_cache: bool,
    use_cached_models_offline: bool,
}

const DOWNLOADER_MAC: &[CommandSpec] = &[
    CommandSpec {
        program: "bash",
        args: &["run.sh"],
    },
    CommandSpec {
        program: ".venv/bin/python",
        args: &["downloader.py"],
    },
];
const DOWNLOADER_WINDOWS: &[CommandSpec] = &[
    CommandSpec {
        program: "cmd.exe",
        args: &["/c", "run.bat"],
    },
    CommandSpec {
        program: ".venv\\Scripts\\python.exe",
        args: &["downloader.py"],
    },
];

const CLIPPER_MAC: &[CommandSpec] = &[
    CommandSpec {
        program: "bash",
        args: &["LTW_Video_Splitter.command"],
    },
    CommandSpec {
        program: "python3",
        args: &["launch_gui.py"],
    },
];
const CLIPPER_WINDOWS: &[CommandSpec] = &[
    CommandSpec {
        program: "cmd.exe",
        args: &["/c", "LTW_Video_Splitter.bat"],
    },
    CommandSpec {
        program: "venv\\Scripts\\python.exe",
        args: &["launch_gui.py"],
    },
];
const CLIPPER_LINUX: &[CommandSpec] = &[
    CommandSpec {
        program: "venv/bin/python",
        args: &["launch_gui.py"],
    },
    CommandSpec {
        program: "python3",
        args: &["launch_gui.py"],
    },
];

const AUDIO_MAC: &[CommandSpec] = &[
    CommandSpec {
        program: "bash",
        args: &["quick_start.sh"],
    },
    CommandSpec {
        program: "venv/bin/python",
        args: &["-m", "streamlit", "run", "app.py"],
    },
];
const AUDIO_WINDOWS: &[CommandSpec] = &[
    CommandSpec {
        program: "cmd.exe",
        args: &["/c", "quick_start.bat"],
    },
    CommandSpec {
        program: "venv\\Scripts\\python.exe",
        args: &["-m", "streamlit", "run", "app.py"],
    },
];

const EDITOR_MAC: &[CommandSpec] = &[CommandSpec {
    program: "npm",
    args: &["run", "start", "--prefix", "photoshop-clone"],
}];
const EDITOR_WINDOWS: &[CommandSpec] = &[CommandSpec {
    program: "npm.cmd",
    args: &["run", "start", "--prefix", "photoshop-clone"],
}];

const TTS_MAC: &[CommandSpec] = &[
    CommandSpec {
        program: "bash",
        args: &["scripts/start_ui.sh"],
    },
    CommandSpec {
        program: ".venv/bin/python",
        args: &["gradio_production_ui.py"],
    },
];
const TTS_WINDOWS: &[CommandSpec] = &[CommandSpec {
    program: ".venv\\Scripts\\python.exe",
    args: &["gradio_production_ui.py"],
}];

fn tool_config(id: &str) -> Option<ToolConfig> {
    match id {
        "downloader" => Some(ToolConfig {
            folders: &["LTW_Downloader"],
            macos: DOWNLOADER_MAC,
            windows: DOWNLOADER_WINDOWS,
            linux: DOWNLOADER_MAC,
            web_url: None,
            needs_numba_cache: false,
            use_cached_models_offline: false,
        }),
        "clipper" => Some(ToolConfig {
            folders: &["LTW_Splitter", "LTW_Clipper"],
            macos: CLIPPER_MAC,
            windows: CLIPPER_WINDOWS,
            linux: CLIPPER_LINUX,
            web_url: None,
            needs_numba_cache: false,
            use_cached_models_offline: false,
        }),
        "audio" => Some(ToolConfig {
            folders: &["LTW_Audio", "LTW_Audio_Spiltter"],
            macos: AUDIO_MAC,
            windows: AUDIO_WINDOWS,
            linux: AUDIO_MAC,
            web_url: None,
            needs_numba_cache: false,
            use_cached_models_offline: false,
        }),
        "editor" => Some(ToolConfig {
            folders: &["LTW Photoshop", "LTW_EzEdit"],
            macos: EDITOR_MAC,
            windows: EDITOR_WINDOWS,
            linux: EDITOR_MAC,
            web_url: None,
            needs_numba_cache: false,
            use_cached_models_offline: false,
        }),
        "tts" => Some(ToolConfig {
            folders: &["TTS-MAc/TTS", "TTS"],
            macos: TTS_MAC,
            windows: TTS_WINDOWS,
            linux: TTS_MAC,
            web_url: Some("http://127.0.0.1:7861"),
            needs_numba_cache: true,
            use_cached_models_offline: true,
        }),
        _ => None,
    }
}

fn home_dir() -> PathBuf {
    env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
}

fn executable_path() -> OsString {
    let mut paths: Vec<PathBuf> = env::var_os("PATH")
        .as_deref()
        .map(env::split_paths)
        .into_iter()
        .flatten()
        .collect();
    if env::consts::OS == "macos" {
        for path in [
            "/opt/homebrew/bin",
            "/opt/homebrew/sbin",
            "/usr/local/bin",
            "/usr/local/sbin",
            "/usr/bin",
            "/bin",
        ] {
            let candidate = PathBuf::from(path);
            if !paths.contains(&candidate) {
                paths.insert(0, candidate);
            }
        }
    }
    env::join_paths(paths).unwrap_or_else(|_| OsString::from("/usr/bin:/bin"))
}

fn candidate_roots(tools_root: Option<&str>) -> Vec<PathBuf> {
    if let Some(root) = tools_root.filter(|root| !root.trim().is_empty()) {
        return vec![PathBuf::from(root)];
    }

    let home = home_dir();
    vec![
        home.join("Desktop/Projects"),
        home.join("Desktop/Python Scripts"),
        home.join("Documents/LTW Tools"),
        home.join("Documents/GitHub"),
        home.join("GitHub"),
        home.join("Developer"),
        home.join("Projects"),
        home.join("Documents"),
    ]
}

fn resolve_tool_path(config: &ToolConfig, tools_root: Option<&str>) -> PathBuf {
    let roots = candidate_roots(tools_root);
    for root in &roots {
        for folder in config.folders {
            let candidate = root.join(folder);
            if candidate.exists() {
                return candidate;
            }
        }
    }
    roots[0].join(config.folders[0])
}

pub(crate) fn tool_path_for_id(id: &str, tools_root: Option<&str>) -> Option<PathBuf> {
    tool_config(id).map(|config| resolve_tool_path(&config, tools_root))
}

fn command_candidates(config: &ToolConfig) -> &'static [CommandSpec] {
    match env::consts::OS {
        "macos" => config.macos,
        "windows" => config.windows,
        _ => config.linux,
    }
}

fn resolve_command(config: &ToolConfig, cwd: &Path) -> Option<CommandSpec> {
    command_candidates(config).iter().find_map(|candidate| {
        let program_is_relative_path =
            candidate.program.contains('/') || candidate.program.contains('\\');
        if program_is_relative_path && !cwd.join(candidate.program).exists() {
            return None;
        }
        let launcher = candidate.args.iter().find(|argument| {
            [".sh", ".command", ".bat", ".py"]
                .iter()
                .any(|extension| argument.ends_with(extension))
        });
        if launcher.is_none_or(|launcher| cwd.join(launcher).exists()) {
            Some(candidate.clone())
        } else {
            None
        }
    })
}

fn open_external(target: &str) {
    let command = match env::consts::OS {
        "macos" => CommandSpec {
            program: "open",
            args: &[],
        },
        "windows" => CommandSpec {
            program: "explorer.exe",
            args: &[],
        },
        _ => CommandSpec {
            program: "xdg-open",
            args: &[],
        },
    };

    let _ = Command::new(command.program)
        .args(command.args)
        .arg(target)
        .env("PATH", executable_path())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();
}

fn open_web_ui_when_ready(url: &'static str) {
    thread::spawn(move || {
        thread::sleep(Duration::from_secs(3));
        let address = SocketAddr::from(([127, 0, 0, 1], 7861));
        for _ in 0..150 {
            if TcpStream::connect_timeout(&address, Duration::from_millis(800)).is_ok() {
                open_external(url);
                return;
            }
            thread::sleep(Duration::from_secs(1));
        }
    });
}

#[tauri::command]
pub async fn detect_tools(tools_root: Option<String>) -> Vec<ToolDetection> {
    ["downloader", "clipper", "audio", "editor", "tts"]
        .iter()
        .filter_map(|id| {
            let config = tool_config(id)?;
            let path = resolve_tool_path(&config, tools_root.as_deref());
            Some(ToolDetection {
                id: (*id).to_string(),
                installed: path.exists(),
                path: path.to_string_lossy().into_owned(),
            })
        })
        .collect()
}

#[tauri::command]
pub fn launch_tool(
    app: AppHandle,
    id: String,
    tools_root: Option<String>,
) -> Result<LaunchResult, String> {
    let config = tool_config(&id).ok_or_else(|| "Unknown tool.".to_string())?;
    let cwd = resolve_tool_path(&config, tools_root.as_deref());
    if !cwd.exists() {
        return Ok(LaunchResult {
            ok: false,
            message: format!("{} was not found in your tool folders.", config.folders[0]),
        });
    }

    let command = match resolve_command(&config, &cwd) {
        Some(command) => command,
        None => {
            return Ok(LaunchResult {
                ok: false,
                message: format!(
                    "{} is installed, but its launcher was not found.",
                    cwd.file_name()
                        .and_then(|name| name.to_str())
                        .unwrap_or("This tool")
                ),
            });
        }
    };

    let mut process = Command::new(command.program);
    process
        .args(command.args)
        .current_dir(&cwd)
        .env("PATH", executable_path())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    if config.needs_numba_cache {
        let cache = app
            .path()
            .app_cache_dir()
            .map_err(|error| error.to_string())?
            .join("numba");
        std::fs::create_dir_all(&cache).map_err(|error| error.to_string())?;
        process.env("NUMBA_CACHE_DIR", cache);
    }

    if config.use_cached_models_offline
        && home_dir()
            .join(".cache/huggingface/hub/models--ResembleAI--chatterbox")
            .exists()
    {
        process.env("HF_HUB_OFFLINE", "1");
    }

    process
        .spawn()
        .map_err(|error| format!("Could not start this tool: {error}"))?;

    let name = cwd
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Tool");

    if let Some(url) = config.web_url {
        open_web_ui_when_ready(url);
        return Ok(LaunchResult {
            ok: true,
            message: format!("{name} is loading. Its web UI will open when ready."),
        });
    }

    Ok(LaunchResult {
        ok: true,
        message: format!("{name} is starting."),
    })
}

#[tauri::command]
pub fn open_path(target_path: String) -> Result<String, String> {
    let target = PathBuf::from(&target_path);
    if !target.is_absolute() || !target.exists() {
        return Err("The requested path is invalid or no longer exists.".to_string());
    }
    open_external(&target_path);
    Ok(String::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_known_tool_has_a_platform_command() {
        for id in ["downloader", "clipper", "audio", "editor", "tts"] {
            let config = tool_config(id).expect("known tool");
            assert!(!command_candidates(&config).is_empty());
        }
    }

    #[test]
    fn unknown_tools_are_rejected() {
        assert!(tool_config("not-a-tool").is_none());
    }
}
