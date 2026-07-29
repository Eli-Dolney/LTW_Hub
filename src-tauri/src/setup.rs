use serde::Serialize;
use std::{
    env,
    ffi::OsString,
    fs,
    path::{Path, PathBuf},
    process::{Command, Output},
};
use tauri::{AppHandle, Emitter};

use crate::tools::tool_path_for_id;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupProgress {
    tool_id: String,
    action: String,
    stage: String,
    message: String,
    percent: u8,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RequirementStatus {
    id: String,
    name: String,
    available: bool,
    version: String,
    required_by: Vec<String>,
    install_hint: String,
    can_install: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolSetupStatus {
    id: String,
    installed: bool,
    configured: bool,
    path: String,
    revision: String,
    has_local_changes: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupSnapshot {
    root: String,
    requirements: Vec<RequirementStatus>,
    tools: Vec<ToolSetupStatus>,
}

#[derive(Debug, Serialize)]
pub struct SetupResult {
    ok: bool,
    message: String,
}

#[derive(Clone, Copy)]
enum Runtime {
    Downloader,
    Clipper,
    Audio,
    Editor,
    Tts,
}

struct InstallConfig {
    id: &'static str,
    name: &'static str,
    repository: &'static str,
    folder: &'static str,
    runtime: Runtime,
}

const INSTALL_CONFIGS: &[InstallConfig] = &[
    InstallConfig {
        id: "downloader",
        name: "LTW Downloader",
        repository: "https://github.com/Eli-Dolney/LTW_Downloader.git",
        folder: "LTW_Downloader",
        runtime: Runtime::Downloader,
    },
    InstallConfig {
        id: "clipper",
        name: "LTW Clipper",
        repository: "https://github.com/Eli-Dolney/LTW_Clipper.git",
        folder: "LTW_Clipper",
        runtime: Runtime::Clipper,
    },
    InstallConfig {
        id: "audio",
        name: "LTW Audio",
        repository: "https://github.com/Eli-Dolney/LTW_Audio_Spiltter.git",
        folder: "LTW_Audio_Spiltter",
        runtime: Runtime::Audio,
    },
    InstallConfig {
        id: "editor",
        name: "LTW EzEdit",
        repository: "https://github.com/Eli-Dolney/LTW_EzEdit.git",
        folder: "LTW_EzEdit",
        runtime: Runtime::Editor,
    },
    InstallConfig {
        id: "tts",
        name: "LTW Voice",
        repository: "https://github.com/Eli-Dolney/TTS.git",
        folder: "TTS",
        runtime: Runtime::Tts,
    },
];

#[derive(Clone)]
struct PythonCommand {
    program: String,
    prefix: Vec<String>,
    version: String,
}

fn config_for(id: &str) -> Option<&'static InstallConfig> {
    INSTALL_CONFIGS.iter().find(|config| config.id == id)
}

fn home_dir() -> PathBuf {
    env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
}

fn managed_root(tools_root: Option<&str>) -> Result<PathBuf, String> {
    let root = tools_root
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| home_dir().join("Documents/LTW Tools"));
    if !root.is_absolute() {
        return Err("Choose an absolute tools folder before installing.".to_string());
    }
    Ok(root)
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

fn command_output(program: &str, args: &[&str], cwd: Option<&Path>) -> Option<Output> {
    let mut command = Command::new(program);
    command.args(args).env("PATH", executable_path());
    if let Some(cwd) = cwd {
        command.current_dir(cwd);
    }
    command.output().ok()
}

fn first_line(output: &Output) -> String {
    let text = if output.stdout.is_empty() {
        &output.stderr
    } else {
        &output.stdout
    };
    String::from_utf8_lossy(text)
        .lines()
        .next()
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn program_version(program: &str, args: &[&str]) -> Option<String> {
    let output = command_output(program, args, None)?;
    output.status.success().then(|| first_line(&output))
}

fn parse_python_version(text: &str) -> Option<(u32, u32)> {
    let version = text.split_whitespace().find(|part| {
        part.chars()
            .next()
            .is_some_and(|character| character.is_ascii_digit())
    })?;
    let mut pieces = version.split('.');
    Some((pieces.next()?.parse().ok()?, pieces.next()?.parse().ok()?))
}

fn python_command(min_minor: u32) -> Option<PythonCommand> {
    let candidates: Vec<(&str, Vec<&str>)> = if env::consts::OS == "windows" {
        vec![
            ("py", vec!["-3.13"]),
            ("py", vec!["-3.12"]),
            ("py", vec!["-3.11"]),
            ("python", vec![]),
        ]
    } else {
        vec![
            ("python3.13", vec![]),
            ("python3.12", vec![]),
            ("python3.11", vec![]),
            ("python3", vec![]),
        ]
    };

    candidates.into_iter().find_map(|(program, prefix)| {
        let mut version_args = prefix.clone();
        version_args.push("--version");
        let output = command_output(program, &version_args, None)?;
        if !output.status.success() {
            return None;
        }
        let version = first_line(&output);
        let (major, minor) = parse_python_version(&version)?;
        (major == 3 && minor >= min_minor).then(|| PythonCommand {
            program: program.to_string(),
            prefix: prefix.into_iter().map(str::to_string).collect(),
            version,
        })
    })
}

fn setup_marker(runtime: Runtime, tool_path: &Path) -> PathBuf {
    let windows = env::consts::OS == "windows";
    match runtime {
        Runtime::Downloader | Runtime::Tts => tool_path.join(if windows {
            ".venv/Scripts/python.exe"
        } else {
            ".venv/bin/python"
        }),
        Runtime::Clipper | Runtime::Audio => tool_path.join(if windows {
            "venv/Scripts/python.exe"
        } else {
            "venv/bin/python"
        }),
        Runtime::Editor => tool_path.join("photoshop-clone/node_modules"),
    }
}

fn requirement(
    id: &str,
    name: &str,
    version: Option<String>,
    required_by: &[&str],
    mac_package: &str,
    windows_package: &str,
) -> RequirementStatus {
    let install_hint = match env::consts::OS {
        "macos" => format!("Homebrew: brew install {mac_package}"),
        "windows" => format!("Windows Package Manager: winget install {windows_package}"),
        _ => format!("Install {name} using your system package manager."),
    };
    RequirementStatus {
        id: id.to_string(),
        name: name.to_string(),
        available: version.is_some(),
        version: version.unwrap_or_default(),
        required_by: required_by
            .iter()
            .map(|value| (*value).to_string())
            .collect(),
        install_hint,
        can_install: match env::consts::OS {
            "macos" => program_version("brew", &["--version"]).is_some(),
            "windows" => program_version("winget", &["--version"]).is_some(),
            _ => false,
        },
    }
}

fn requirement_snapshot() -> Vec<RequirementStatus> {
    let python = python_command(12).map(|python| python.version);
    vec![
        requirement(
            "git",
            "Git",
            program_version("git", &["--version"]),
            &["Tool installation and updates"],
            "git",
            "--id Git.Git -e",
        ),
        requirement(
            "python",
            "Python 3.12+",
            python,
            &["Downloader", "Clipper", "Audio", "Voice"],
            "python@3.12",
            "--id Python.Python.3.12 -e",
        ),
        requirement(
            "node",
            "Node.js",
            program_version("node", &["--version"]),
            &["Downloader", "EzEdit"],
            "node",
            "--id OpenJS.NodeJS.LTS -e",
        ),
        requirement(
            "ffmpeg",
            "FFmpeg",
            program_version("ffmpeg", &["-version"]),
            &["Downloader", "Clipper", "Audio", "Voice"],
            "ffmpeg",
            "--id Gyan.FFmpeg -e",
        ),
    ]
}

fn git_value(path: &Path, args: &[&str]) -> String {
    command_output("git", args, Some(path))
        .filter(|output| output.status.success())
        .map(|output| first_line(&output))
        .unwrap_or_default()
}

fn tool_snapshot(id: &str, tools_root: Option<&str>) -> Option<ToolSetupStatus> {
    let config = config_for(id)?;
    let path = tool_path_for_id(id, tools_root)?;
    let installed = path.join(".git").exists();
    let configured = setup_marker(config.runtime, &path).exists();
    let revision = if installed {
        git_value(&path, &["rev-parse", "--short", "HEAD"])
    } else {
        String::new()
    };
    let has_local_changes = installed
        && !git_value(&path, &["status", "--porcelain", "--untracked-files=no"]).is_empty();
    Some(ToolSetupStatus {
        id: id.to_string(),
        installed,
        configured,
        path: path.to_string_lossy().into_owned(),
        revision,
        has_local_changes,
    })
}

#[tauri::command]
pub async fn setup_snapshot(tools_root: Option<String>) -> Result<SetupSnapshot, String> {
    let root = managed_root(tools_root.as_deref())?;
    let tools = INSTALL_CONFIGS
        .iter()
        .filter_map(|config| tool_snapshot(config.id, tools_root.as_deref()))
        .collect();
    Ok(SetupSnapshot {
        root: root.to_string_lossy().into_owned(),
        requirements: requirement_snapshot(),
        tools,
    })
}

fn emit_progress(
    app: Option<&AppHandle>,
    tool_id: &str,
    action: &str,
    stage: &str,
    message: impl Into<String>,
    percent: u8,
) {
    if let Some(app) = app {
        let _ = app.emit(
            "setup-progress",
            SetupProgress {
                tool_id: tool_id.to_string(),
                action: action.to_string(),
                stage: stage.to_string(),
                message: message.into(),
                percent,
            },
        );
    }
}

fn output_error(output: &Output) -> String {
    let text = if output.stderr.is_empty() {
        &output.stdout
    } else {
        &output.stderr
    };
    let message = String::from_utf8_lossy(text);
    message
        .lines()
        .rev()
        .find(|line| !line.trim().is_empty())
        .unwrap_or("The command did not complete successfully.")
        .trim()
        .to_string()
}

fn run_checked(program: &str, args: &[String], cwd: Option<&Path>) -> Result<(), String> {
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let output = command_output(program, &arg_refs, cwd)
        .ok_or_else(|| format!("{program} is not installed or could not be started."))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(output_error(&output))
    }
}

fn venv_python(tool_path: &Path, venv: &str) -> String {
    tool_path
        .join(if env::consts::OS == "windows" {
            format!("{venv}/Scripts/python.exe")
        } else {
            format!("{venv}/bin/python")
        })
        .to_string_lossy()
        .into_owned()
}

fn ensure_venv(
    app: Option<&AppHandle>,
    config: &InstallConfig,
    tool_path: &Path,
    action: &str,
    venv: &str,
    min_python_minor: u32,
) -> Result<String, String> {
    let python_path = venv_python(tool_path, venv);
    if Path::new(&python_path).exists() {
        return Ok(python_path);
    }
    let python = python_command(min_python_minor).ok_or_else(|| {
        format!(
            "{} needs Python 3.{} or newer. Install Python from the Requirements section first.",
            config.name, min_python_minor
        )
    })?;
    emit_progress(
        app,
        config.id,
        action,
        "environment",
        "Creating a private Python environment…",
        42,
    );
    let mut args = python.prefix;
    args.extend(["-m".to_string(), "venv".to_string(), venv.to_string()]);
    run_checked(&python.program, &args, Some(tool_path))?;
    Ok(python_path)
}

fn install_python_dependencies(
    app: Option<&AppHandle>,
    config: &InstallConfig,
    tool_path: &Path,
    action: &str,
    venv: &str,
    min_python_minor: u32,
    install_args: &[&[&str]],
) -> Result<(), String> {
    let python = ensure_venv(app, config, tool_path, action, venv, min_python_minor)?;
    emit_progress(
        app,
        config.id,
        action,
        "dependencies",
        "Updating the package installer…",
        58,
    );
    run_checked(
        &python,
        &[
            "-m".into(),
            "pip".into(),
            "install".into(),
            "--upgrade".into(),
            "pip".into(),
            "setuptools".into(),
            "wheel".into(),
        ],
        Some(tool_path),
    )?;
    for (index, extra_args) in install_args.iter().enumerate() {
        let percent = 68 + ((index as u8) * 18 / install_args.len().max(1) as u8);
        emit_progress(
            app,
            config.id,
            action,
            "dependencies",
            format!(
                "Installing dependencies ({}/{})…",
                index + 1,
                install_args.len()
            ),
            percent,
        );
        let mut args = vec!["-m".to_string(), "pip".to_string(), "install".to_string()];
        args.extend(extra_args.iter().map(|value| (*value).to_string()));
        run_checked(&python, &args, Some(tool_path))?;
    }
    Ok(())
}

fn configure_tool(
    app: Option<&AppHandle>,
    config: &InstallConfig,
    tool_path: &Path,
    action: &str,
) -> Result<(), String> {
    match config.runtime {
        Runtime::Downloader => install_python_dependencies(
            app,
            config,
            tool_path,
            action,
            ".venv",
            12,
            &[&["-r", "requirements.txt"]],
        ),
        Runtime::Clipper => install_python_dependencies(
            app,
            config,
            tool_path,
            action,
            "venv",
            10,
            &[&["-r", "requirements.txt"]],
        ),
        Runtime::Audio => install_python_dependencies(
            app,
            config,
            tool_path,
            action,
            "venv",
            10,
            &[&["-r", "requirements.txt"]],
        ),
        Runtime::Tts => install_python_dependencies(
            app,
            config,
            tool_path,
            action,
            ".venv",
            11,
            &[&["-e", "."], &["-e", ".[production]"]],
        ),
        Runtime::Editor => {
            emit_progress(
                app,
                config.id,
                action,
                "dependencies",
                "Installing EzEdit packages…",
                68,
            );
            let editor_path = tool_path.join("photoshop-clone");
            if !editor_path.join("package.json").exists() {
                return Err("EzEdit's package file was not found.".to_string());
            }
            run_checked("npm", &["install".into()], Some(&editor_path))
        }
    }
}

fn manage_tool_sync(
    app: Option<AppHandle>,
    id: String,
    action: String,
    tools_root: Option<String>,
) -> Result<SetupResult, String> {
    let config = config_for(&id).ok_or_else(|| "Unknown LTW tool.".to_string())?;
    if !["install", "update", "repair"].contains(&action.as_str()) {
        return Err("Unknown setup action.".to_string());
    }
    let root = managed_root(tools_root.as_deref())?;
    fs::create_dir_all(&root)
        .map_err(|error| format!("Could not create the tools folder: {error}"))?;
    let target = tool_path_for_id(config.id, tools_root.as_deref())
        .filter(|path| path.exists())
        .unwrap_or_else(|| root.join(config.folder));

    emit_progress(
        app.as_ref(),
        config.id,
        &action,
        "starting",
        format!("Preparing {}…", config.name),
        5,
    );

    if !target.exists() {
        if action != "install" {
            return Err(format!("{} is not installed yet.", config.name));
        }
        emit_progress(
            app.as_ref(),
            config.id,
            &action,
            "download",
            "Downloading the tool from GitHub…",
            18,
        );
        run_checked(
            "git",
            &[
                "clone".into(),
                "--depth".into(),
                "1".into(),
                config.repository.into(),
                target.to_string_lossy().into_owned(),
            ],
            Some(&root),
        )?;
    } else if !target.join(".git").exists() {
        return Err(format!(
            "{} already exists but is not a Git repository. Choose another tools folder or move that folder first.",
            target.display()
        ));
    } else if action == "update" {
        let changes = git_value(&target, &["status", "--porcelain", "--untracked-files=no"]);
        if !changes.is_empty() {
            return Err(
                "This tool has local code changes. Commit or restore them before updating."
                    .to_string(),
            );
        }
        emit_progress(
            app.as_ref(),
            config.id,
            &action,
            "download",
            "Checking GitHub and applying the latest update…",
            24,
        );
        run_checked(
            "git",
            &[
                "-C".into(),
                target.to_string_lossy().into_owned(),
                "pull".into(),
                "--ff-only".into(),
            ],
            None,
        )?;
    }

    configure_tool(app.as_ref(), config, &target, &action)?;
    emit_progress(
        app.as_ref(),
        config.id,
        &action,
        "complete",
        format!("{} is ready.", config.name),
        100,
    );
    Ok(SetupResult {
        ok: true,
        message: format!("{} is installed and ready to launch.", config.name),
    })
}

#[tauri::command]
pub async fn manage_tool(
    app: AppHandle,
    id: String,
    action: String,
    tools_root: Option<String>,
) -> Result<SetupResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        manage_tool_sync(Some(app), id, action, tools_root)
    })
    .await
    .map_err(|error| format!("The setup task stopped unexpectedly: {error}"))?
}

fn requirement_package(id: &str) -> Option<(&'static str, &'static [&'static str])> {
    match (env::consts::OS, id) {
        ("macos", "git") => Some(("brew", &["install", "git"])),
        ("macos", "python") => Some(("brew", &["install", "python@3.12"])),
        ("macos", "node") => Some(("brew", &["install", "node"])),
        ("macos", "ffmpeg") => Some(("brew", &["install", "ffmpeg"])),
        ("windows", "git") => Some((
            "winget",
            &[
                "install",
                "--id",
                "Git.Git",
                "-e",
                "--accept-package-agreements",
                "--accept-source-agreements",
            ],
        )),
        ("windows", "python") => Some((
            "winget",
            &[
                "install",
                "--id",
                "Python.Python.3.12",
                "-e",
                "--accept-package-agreements",
                "--accept-source-agreements",
            ],
        )),
        ("windows", "node") => Some((
            "winget",
            &[
                "install",
                "--id",
                "OpenJS.NodeJS.LTS",
                "-e",
                "--accept-package-agreements",
                "--accept-source-agreements",
            ],
        )),
        ("windows", "ffmpeg") => Some((
            "winget",
            &[
                "install",
                "--id",
                "Gyan.FFmpeg",
                "-e",
                "--accept-package-agreements",
                "--accept-source-agreements",
            ],
        )),
        _ => None,
    }
}

#[tauri::command]
pub async fn install_requirement(app: AppHandle, id: String) -> Result<SetupResult, String> {
    let (program, args) = requirement_package(&id)
        .ok_or_else(|| "Automatic installation is not available on this system.".to_string())?;
    let id_for_task = id.clone();
    let args: Vec<String> = args.iter().map(|value| (*value).to_string()).collect();
    tauri::async_runtime::spawn_blocking(move || {
        emit_progress(
            Some(&app),
            &id_for_task,
            "requirement",
            "installing",
            format!("Installing {id_for_task}…"),
            35,
        );
        run_checked(program, &args, None)?;
        emit_progress(
            Some(&app),
            &id_for_task,
            "requirement",
            "complete",
            format!("{id_for_task} is installed."),
            100,
        );
        Ok(SetupResult {
            ok: true,
            message: "Requirement installed. A restart may be needed before it appears on PATH."
                .to_string(),
        })
    })
    .await
    .map_err(|error| format!("The installer stopped unexpectedly: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn disposable_root(label: &str) -> PathBuf {
        env::temp_dir().join(format!(
            "ltw-hub-{label}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("system clock")
                .as_nanos()
        ))
    }

    #[test]
    fn rejects_unknown_tools() {
        assert!(config_for("unknown").is_none());
    }

    #[test]
    fn parses_python_versions() {
        assert_eq!(parse_python_version("Python 3.12.7"), Some((3, 12)));
        assert_eq!(parse_python_version("Python 3.9.1"), Some((3, 9)));
        assert_eq!(parse_python_version("not python"), None);
    }

    #[test]
    fn public_install_targets_are_unique() {
        let mut folders: Vec<&str> = INSTALL_CONFIGS.iter().map(|config| config.folder).collect();
        folders.sort_unstable();
        folders.dedup();
        assert_eq!(folders.len(), INSTALL_CONFIGS.len());
    }

    #[test]
    fn install_refuses_an_existing_non_repository_folder() {
        let root = disposable_root("non-repository");
        let target = root.join("LTW_Downloader");
        fs::create_dir_all(&target).expect("create test folder");
        fs::write(target.join("personal-file.txt"), "keep me").expect("write test file");
        let result = manage_tool_sync(
            None,
            "downloader".to_string(),
            "install".to_string(),
            Some(root.to_string_lossy().into_owned()),
        );
        let personal_file_survived = target.join("personal-file.txt").exists();
        fs::remove_dir_all(&root).expect("remove disposable test folder");

        assert!(result.is_err());
        assert!(personal_file_survived);
    }

    #[test]
    fn update_refuses_local_tracked_changes() {
        let root = disposable_root("local-changes");
        let target = root.join("LTW_Downloader");
        fs::create_dir_all(&target).expect("create test folder");
        for args in [
            vec!["init"],
            vec!["config", "user.name", "LTW Test"],
            vec!["config", "user.email", "test@example.invalid"],
        ] {
            let output = command_output("git", &args, Some(&target)).expect("run git");
            assert!(output.status.success());
        }
        fs::write(target.join("tracked.txt"), "original").expect("write tracked file");
        for args in [vec!["add", "tracked.txt"], vec!["commit", "-m", "test"]] {
            let output = command_output("git", &args, Some(&target)).expect("run git");
            assert!(output.status.success(), "{}", output_error(&output));
        }
        fs::write(target.join("tracked.txt"), "changed").expect("modify tracked file");

        let result = manage_tool_sync(
            None,
            "downloader".to_string(),
            "update".to_string(),
            Some(root.to_string_lossy().into_owned()),
        );
        let changed_content = fs::read_to_string(target.join("tracked.txt")).expect("read file");
        fs::remove_dir_all(&root).expect("remove disposable test folder");

        assert!(result
            .as_ref()
            .is_err_and(|message| message.contains("local code changes")));
        assert_eq!(changed_content, "changed");
    }

    #[test]
    #[ignore = "downloads a public tool and its dependencies"]
    fn downloader_install_update_and_repair_smoke_test() {
        let root = disposable_root("setup-smoke");
        let root_text = root.to_string_lossy().into_owned();

        let install = manage_tool_sync(
            None,
            "downloader".to_string(),
            "install".to_string(),
            Some(root_text.clone()),
        );
        let marker_exists =
            setup_marker(Runtime::Downloader, &root.join("LTW_Downloader")).exists();
        let update = install.as_ref().ok().and_then(|_| {
            manage_tool_sync(
                None,
                "downloader".to_string(),
                "update".to_string(),
                Some(root_text.clone()),
            )
            .ok()
        });
        let repair = update.as_ref().and_then(|_| {
            manage_tool_sync(
                None,
                "downloader".to_string(),
                "repair".to_string(),
                Some(root_text),
            )
            .ok()
        });

        if root.exists() {
            fs::remove_dir_all(&root).expect("remove disposable smoke-test folder");
        }

        assert!(install.is_ok(), "install failed: {install:?}");
        assert!(
            marker_exists,
            "installer did not create the private environment"
        );
        assert!(update.is_some(), "update did not complete");
        assert!(repair.is_some(), "repair did not complete");
    }
}
