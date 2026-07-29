import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  AudioLines,
  Bell,
  Blocks,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  CloudOff,
  Command,
  Download,
  Folder,
  FolderOpen,
  Gauge,
  Grid2X2,
  HardDrive,
  Home,
  Image,
  Layers3,
  ListVideo,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Video,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import { INITIAL_TOOLS, SEED_PROJECTS, SEED_QUEUE } from "./data";
import { useLocalStorage } from "./hooks/useLocalStorage";
import type { Project, Tool, View } from "./types";

const navItems: { id: View; label: string; icon: typeof Home }[] = [
  { id: "dashboard", label: "Home", icon: Home },
  { id: "projects", label: "Projects", icon: Folder },
  { id: "tools", label: "Tools", icon: Blocks },
  { id: "queue", label: "Queue", icon: ListVideo },
];

const workflow = [
  { id: "downloader", label: "Capture", icon: Download },
  { id: "clipper", label: "Clip", icon: Video },
  { id: "audio", label: "Audio", icon: AudioLines },
  { id: "editor", label: "Design", icon: Image },
  { id: "publish", label: "Deliver", icon: Rocket },
];

function App() {
  const [view, setView] = useState<View>("dashboard");
  const [projects, setProjects] = useLocalStorage<Project[]>("ltw-projects", SEED_PROJECTS);
  const [toolsRoot, setToolsRoot] = useLocalStorage("ltw-tools-root", "");
  const [tools, setTools] = useState<Tool[]>(INITIAL_TOOLS);
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");

  const detectTools = async () => {
    if (!window.ltwHub) return;
    const detected = await window.ltwHub.detectTools(toolsRoot || undefined);
    setTools((current) =>
      current.map((tool) => {
        const match = detected.find((item) => item.id === tool.id);
        return match ? { ...tool, installed: match.installed, path: match.path } : tool;
      }),
    );
  };

  useEffect(() => {
    detectTools();
    // Electron tool availability is refreshed when the root changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsRoot]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const launchTool = async (tool: Tool) => {
    if (!window.ltwHub) {
      setToast("Desktop launching is available inside the LTW Hub app.");
      return;
    }
    const result = await window.ltwHub.launchTool(tool.id, toolsRoot || undefined);
    setToast(result.message);
  };

  const chooseToolsRoot = async () => {
    if (!window.ltwHub) {
      setToast("Folder selection is available in the desktop app.");
      return;
    }
    const selected = await window.ltwHub.chooseToolsRoot();
    if (selected) setToolsRoot(selected);
  };

  const addProject = (title: string, type: Project["type"]) => {
    const next: Project = {
      id: crypto.randomUUID(),
      title,
      type,
      status: "Draft",
      progress: 5,
      updatedAt: "Just now",
      sourceCount: 0,
      accent: ["violet", "cyan", "amber", "rose"][projects.length % 4] as Project["accent"],
    };
    setProjects([next, ...projects]);
    setProjectModalOpen(false);
    setView("projects");
    setToast("Project created. Add source media when you’re ready.");
  };

  const title = {
    dashboard: "Good morning, Eli",
    projects: "Projects",
    tools: "Your tools",
    queue: "Processing queue",
    settings: "Settings",
  }[view];

  return (
    <div className="app-shell">
      <Sidebar view={view} onNavigate={setView} queueCount={SEED_QUEUE.length} />
      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">{view === "dashboard" ? "Wednesday, July 29" : "LTW Hub"}</div>
            <h1>{title}</h1>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={16} />
              <input
                aria-label="Search"
                placeholder="Search everything"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <span className="shortcut">⌘ K</span>
            </label>
            <button className="icon-button" aria-label="Notifications">
              <Bell size={18} />
              <span className="notification-dot" />
            </button>
            <button className="primary-button" onClick={() => setProjectModalOpen(true)}>
              <Plus size={17} />
              New project
            </button>
          </div>
        </header>

        {view === "dashboard" && (
          <Dashboard
            projects={projects}
            tools={tools}
            onNavigate={setView}
            onNewProject={() => setProjectModalOpen(true)}
            onLaunch={launchTool}
          />
        )}
        {view === "projects" && (
          <ProjectsView
            projects={projects.filter((project) =>
              project.title.toLowerCase().includes(search.toLowerCase()),
            )}
            onNewProject={() => setProjectModalOpen(true)}
          />
        )}
        {view === "tools" && (
          <ToolsView
            tools={tools}
            onLaunch={launchTool}
            onDetect={detectTools}
            onChooseRoot={chooseToolsRoot}
          />
        )}
        {view === "queue" && <QueueView />}
        {view === "settings" && (
          <SettingsView toolsRoot={toolsRoot} onChooseRoot={chooseToolsRoot} onDetect={detectTools} />
        )}
      </main>

      {isProjectModalOpen && (
        <NewProjectModal onClose={() => setProjectModalOpen(false)} onCreate={addProject} />
      )}
      {toast && (
        <div className="toast">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}

function Sidebar({
  view,
  onNavigate,
  queueCount,
}: {
  view: View;
  onNavigate: (view: View) => void;
  queueCount: number;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <span />
          <span />
          <span />
        </div>
        <div>
          <strong>LTW</strong>
          <span>HUB</span>
        </div>
      </div>

      <nav>
        <div className="nav-label">Workspace</div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? "active" : ""}`}
              onClick={() => onNavigate(item.id)}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{item.label}</span>
              {item.id === "queue" && <em>{queueCount}</em>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-spacer" />
      <div className="local-card">
        <div className="local-icon">
          <CloudOff size={18} />
        </div>
        <div>
          <strong>100% local</strong>
          <span>Your media stays yours.</span>
        </div>
      </div>
      <button
        className={`nav-item ${view === "settings" ? "active" : ""}`}
        onClick={() => onNavigate("settings")}
      >
        <Settings size={18} />
        <span>Settings</span>
      </button>
      <button className="profile">
        <span className="avatar">ED</span>
        <span>
          <strong>Eli Dolney</strong>
          <small>Local workspace</small>
        </span>
        <MoreHorizontal size={18} />
      </button>
    </aside>
  );
}

function Dashboard({
  projects,
  tools,
  onNavigate,
  onNewProject,
  onLaunch,
}: {
  projects: Project[];
  tools: Tool[];
  onNavigate: (view: View) => void;
  onNewProject: () => void;
  onLaunch: (tool: Tool) => void;
}) {
  const installedCount = tools.filter((tool) => tool.installed).length;
  return (
    <div className="page">
      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-copy">
          <span className="pill">
            <Sparkles size={14} /> Creator command center
          </span>
          <h2>One idea. Every tool.<br />A finished release.</h2>
          <p>
            Bring your local creator workflow into one place—from source footage to the final export.
          </p>
          <div className="hero-actions">
            <button className="primary-button large" onClick={onNewProject}>
              <Plus size={18} /> Start a project
            </button>
            <button className="secondary-button" onClick={() => onNavigate("tools")}>
              Explore tools <ArrowRight size={17} />
            </button>
          </div>
        </div>
        <div className="hero-visual" aria-label="Creator workflow illustration">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="center-node">
            <Zap size={30} fill="currentColor" />
          </div>
          <div className="float-node node-video"><Video size={19} /></div>
          <div className="float-node node-audio"><AudioLines size={19} /></div>
          <div className="float-node node-image"><Image size={19} /></div>
          <div className="float-node node-magic"><WandSparkles size={19} /></div>
        </div>
      </section>

      <section className="workflow-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Connected workflow</span>
            <h3>Your creative pipeline</h3>
          </div>
          <span className="subtle-text">{installedCount} of {tools.length} tools detected</span>
        </div>
        <div className="workflow">
          {workflow.map((step, index) => {
            const Icon = step.icon;
            return (
              <div className="workflow-group" key={step.id}>
                <button className={`workflow-step ${index === 1 ? "featured" : ""}`}>
                  <span><Icon size={20} /></span>
                  <strong>{step.label}</strong>
                  <small>{index === 4 ? "Package" : "LTW tool"}</small>
                </button>
                {index < workflow.length - 1 && <ArrowRight className="workflow-arrow" size={18} />}
              </div>
            );
          })}
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="content-card projects-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Pick up where you left off</span>
              <h3>Recent projects</h3>
            </div>
            <button className="text-button" onClick={() => onNavigate("projects")}>
              View all <ArrowRight size={15} />
            </button>
          </div>
          <div className="project-list">
            {projects.slice(0, 3).map((project) => <ProjectRow project={project} key={project.id} />)}
          </div>
        </section>

        <section className="content-card now-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Processing now</span>
              <h3>Active queue</h3>
            </div>
            <span className="live-dot">Live</span>
          </div>
          <div className="queue-focus">
            <div className="queue-focus-icon"><Video size={21} /></div>
            <div className="queue-focus-copy">
              <strong>Generating vertical clips</strong>
              <span>Building a Local AI Studio</span>
            </div>
            <button className="icon-button"><MoreHorizontal size={17} /></button>
          </div>
          <div className="progress-line"><span style={{ width: "68%" }} /></div>
          <div className="progress-meta">
            <span>Clip 4 of 6</span>
            <strong>68%</strong>
            <span>~4 min left</span>
          </div>
          <button className="secondary-button full" onClick={() => onNavigate("queue")}>
            Open queue <ArrowRight size={16} />
          </button>
        </section>
      </div>

      <section className="tools-strip">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Your studio</span>
            <h3>Quick launch</h3>
          </div>
          <button className="text-button" onClick={() => onNavigate("tools")}>
            Manage tools <SlidersHorizontal size={15} />
          </button>
        </div>
        <div className="quick-tools">
          {tools.slice(0, 4).map((tool) => (
            <button className="quick-tool" key={tool.id} onClick={() => onLaunch(tool)}>
              <span className="tool-monogram" style={{ "--tool-color": tool.color } as React.CSSProperties}>
                {tool.shortName}
              </span>
              <span>
                <strong>{tool.name}</strong>
                <small>{tool.installed ? "Ready to launch" : "Not detected"}</small>
              </span>
              <Play size={15} fill="currentColor" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProjectRow({ project }: { project: Project }) {
  return (
    <button className="project-row">
      <span className={`project-thumb ${project.accent}`}>
        {project.type === "Audio remix" ? <AudioLines /> : <Video />}
      </span>
      <span className="project-info">
        <strong>{project.title}</strong>
        <small>{project.type} · {project.sourceCount} sources</small>
      </span>
      <span className={`status status-${project.status.toLowerCase()}`}>{project.status}</span>
      <span className="project-progress">
        <span><i style={{ width: `${project.progress}%` }} /></span>
        <small>{project.progress}%</small>
      </span>
      <span className="updated">{project.updatedAt}</span>
      <MoreHorizontal size={17} />
    </button>
  );
}

function ProjectsView({
  projects,
  onNewProject,
}: {
  projects: Project[];
  onNewProject: () => void;
}) {
  return (
    <div className="page">
      <div className="view-toolbar">
        <div className="filter-tabs">
          <button className="active">All projects</button>
          <button>In progress</button>
          <button>Completed</button>
        </div>
        <button className="secondary-button"><Grid2X2 size={16} /> Grid view <ChevronDown size={14} /></button>
      </div>
      <div className="project-grid">
        <button className="new-project-card" onClick={onNewProject}>
          <span><Plus size={24} /></span>
          <strong>Start something new</strong>
          <small>Create a reusable local workspace</small>
        </button>
        {projects.map((project) => (
          <article className="project-card" key={project.id}>
            <div className={`project-cover ${project.accent}`}>
              {project.type === "Audio remix" ? <AudioLines size={36} /> : <Video size={36} />}
              <span className={`status status-${project.status.toLowerCase()}`}>{project.status}</span>
            </div>
            <div className="project-card-body">
              <span className="eyebrow">{project.type}</span>
              <h3>{project.title}</h3>
              <div className="project-card-meta">
                <span><HardDrive size={14} /> {project.sourceCount} sources</span>
                <span><Clock3 size={14} /> {project.updatedAt}</span>
              </div>
              <div className="progress-line"><span style={{ width: `${project.progress}%` }} /></div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ToolsView({
  tools,
  onLaunch,
  onDetect,
  onChooseRoot,
}: {
  tools: Tool[];
  onLaunch: (tool: Tool) => void;
  onDetect: () => void;
  onChooseRoot: () => void;
}) {
  return (
    <div className="page">
      <section className="connect-banner">
        <div className="connect-icon"><Command size={23} /></div>
        <div>
          <strong>Local tool bridge</strong>
          <p>Hub detects your LTW repositories and starts each app using its native launcher.</p>
        </div>
        <button className="secondary-button" onClick={onChooseRoot}><FolderOpen size={16} /> Set tools folder</button>
        <button className="primary-button" onClick={onDetect}><RefreshCw size={16} /> Scan now</button>
      </section>
      <div className="tool-grid">
        {tools.map((tool) => (
          <article className="tool-card" key={tool.id}>
            <div className="tool-card-top">
              <span className="tool-monogram large" style={{ "--tool-color": tool.color } as React.CSSProperties}>
                {tool.shortName}
              </span>
              <span className={`detected ${tool.installed ? "yes" : ""}`}>
                <i /> {tool.installed ? "Detected" : "Not found"}
              </span>
            </div>
            <span className="eyebrow">{tool.category}</span>
            <h3>{tool.name}</h3>
            <p>{tool.description}</p>
            <div className="tool-card-actions">
              <button className="primary-button" onClick={() => onLaunch(tool)} disabled={!tool.installed && !!window.ltwHub}>
                <Play size={16} fill="currentColor" /> Launch
              </button>
              <button className="icon-button" aria-label={`Configure ${tool.name}`}><Settings size={16} /></button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function QueueView() {
  return (
    <div className="page">
      <div className="stats-grid">
        <StatCard label="Running" value="1" icon={Zap} color="violet" />
        <StatCard label="Waiting" value="1" icon={Clock3} color="amber" />
        <StatCard label="Completed today" value="8" icon={Check} color="cyan" />
        <StatCard label="Time saved" value="2.4h" icon={Gauge} color="rose" />
      </div>
      <section className="content-card">
        <div className="section-heading">
          <div><span className="eyebrow">Local processing</span><h3>Current jobs</h3></div>
          <button className="secondary-button"><SlidersHorizontal size={16} /> Queue settings</button>
        </div>
        <div className="queue-list">
          {SEED_QUEUE.map((item) => (
            <div className="queue-row" key={item.id}>
              <span className={`queue-state ${item.status.toLowerCase()}`}>
                {item.status === "Running" ? <RefreshCw size={18} /> : <Clock3 size={18} />}
              </span>
              <span className="queue-copy">
                <strong>{item.title}</strong>
                <small>{item.detail} · {item.tool}</small>
              </span>
              <span className={`status status-${item.status.toLowerCase()}`}>{item.status}</span>
              <div className="queue-progress">
                <div className="progress-line"><span style={{ width: `${item.progress}%` }} /></div>
                <small>{item.progress ? `${item.progress}%` : "Starts next"}</small>
              </div>
              <button className="icon-button"><MoreHorizontal size={17} /></button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: typeof Zap;
  color: string;
}) {
  return (
    <article className="stat-card">
      <span className={`stat-icon ${color}`}><Icon size={19} /></span>
      <div><strong>{value}</strong><span>{label}</span></div>
    </article>
  );
}

function SettingsView({
  toolsRoot,
  onChooseRoot,
  onDetect,
}: {
  toolsRoot: string;
  onChooseRoot: () => void;
  onDetect: () => void;
}) {
  return (
    <div className="page settings-page">
      <section className="content-card settings-card">
        <div className="settings-icon"><FolderOpen size={21} /></div>
        <div className="settings-copy">
          <h3>Tools folder</h3>
          <p>Hub automatically checks your Desktop Projects and Python Scripts folders. Choose a folder here only to override them.</p>
          <code>{toolsRoot || "Automatic: ~/Desktop/Projects + ~/Desktop/Python Scripts"}</code>
        </div>
        <button className="secondary-button" onClick={onChooseRoot}>Choose folder</button>
      </section>
      <section className="content-card settings-card">
        <div className="settings-icon"><RefreshCw size={21} /></div>
        <div className="settings-copy">
          <h3>Tool discovery</h3>
          <p>Scan the tools folder again after cloning, moving, or updating a repository.</p>
        </div>
        <button className="secondary-button" onClick={onDetect}>Scan now</button>
      </section>
      <section className="content-card settings-card">
        <div className="settings-icon"><HardDrive size={21} /></div>
        <div className="settings-copy">
          <h3>Local project data</h3>
          <p>Projects and preferences stay on this machine. Cloud sync is never enabled automatically.</p>
        </div>
        <span className="privacy-badge"><Check size={14} /> Local only</span>
      </section>
      <section className="content-card settings-card">
        <div className="settings-icon"><CircleHelp size={21} /></div>
        <div className="settings-copy">
          <h3>About LTW Hub</h3>
          <p>Creator command center · Version 0.1.0</p>
        </div>
      </section>
    </div>
  );
}

function NewProjectModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (title: string, type: Project["type"]) => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<Project["type"]>("Shorts package");
  const options = useMemo(
    () => [
      { label: "Shorts package", icon: WandSparkles, description: "Highlights, captions, vertical exports" },
      { label: "Long-form video", icon: Video, description: "Organize, edit, and package a full video" },
      { label: "Audio remix", icon: AudioLines, description: "Stems, analysis, and remix patterns" },
      { label: "Quick edit", icon: Image, description: "A thumbnail, graphic, or one-off export" },
    ] as const,
    [],
  );

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <div><span className="eyebrow">New local workspace</span><h2>What are we making?</h2></div>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        <label className="field">
          <span>Project name</span>
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. My next creator video"
          />
        </label>
        <div className="template-options">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <button
                className={type === option.label ? "selected" : ""}
                onClick={() => setType(option.label)}
                key={option.label}
              >
                <span><Icon size={19} /></span>
                <div><strong>{option.label}</strong><small>{option.description}</small></div>
                <i>{type === option.label && <Check size={13} />}</i>
              </button>
            );
          })}
        </div>
        <div className="modal-actions">
          <span><CloudOff size={14} /> Saved locally</span>
          <button className="secondary-button" onClick={onClose}>Cancel</button>
          <button
            className="primary-button"
            disabled={!title.trim()}
            onClick={() => onCreate(title.trim(), type)}
          >
            Create project <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}

export default App;
