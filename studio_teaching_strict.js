const NODE_WIDTH = 260;
const NODE_HEIGHT = 168;
const GRID_OFFSET = 12;
const GRID_SIZE = 24;
const LOCAL_STATE_KEY = "phycs_teacher_workspace_v2";
const LEGACY_LOCAL_STATE_KEYS = ["phycs_teacher_workspace_v1"];
const API_BASE = window.location.protocol === "file:" ? "http://localhost:5173" : "";
const apiUrl = (p) => (API_BASE ? `${API_BASE}${p}` : p);
const toAssetUrl = (u) => {
  const s = String(u || "");
  if (!s) return "";
  if (s.startsWith("blob:") || s.startsWith("data:") || /^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return API_BASE ? `${API_BASE}${s}` : s;
  return s;
};

async function ensureServedMode() {
  if (window.location.protocol !== "file:") return true;
  if (!API_BASE) return true;
  try {
    const health = await fetch(apiUrl("/api/health"), { cache: "no-store" });
    if (!health.ok) return true;
    const target = `${API_BASE}/studio_teaching_strict_demo.html`;
    if (!window.location.href.startsWith(target)) {
      window.location.replace(target);
      return false;
    }
  } catch {}
  return true;
}

const CONTENT_OPTIONS = [
  { key: "ppt", label: "PPT", needFile: true },
  { key: "video", label: "Video", needFile: true },
  { key: "quiz", label: "Quiz", needFile: true },
  { key: "interactive", label: "Interactive Activity", needFile: true },
  { key: "ai_assistant", label: "AI Assistant", needFile: false },
  { key: "decision", label: "Branch Decision", needFile: false },
  { key: "merge", label: "Merge", needFile: false },
];

const COLOR_OPTIONS = ["#5f8dff", "#20d6bf", "#f7b84b", "#f86e9f", "#a782ff", "#6ed68b"];
const SHAPE_OPTIONS = ["rounded", "circle", "diamond", "hex"];
const AI_MODEL_OPTIONS = [
  { value: "deepseek-chat", label: "DeepSeek Chat", hint: "Fast Q&A and teaching explanations" },
  { value: "deepseek-reasoner", label: "DeepSeek Reasoner", hint: "Stronger reasoning for step-by-step problem analysis" },
];

const PDFJS_SCRIPT_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const pdfRuntime = {
  scriptPromise: null,
  docs: new Map(),
  renderSeq: 0,
};

const state = {
  seq: { project: 1000, module: 2000, publish: 3000 },
  projects: [],
  currentProjectId: null,
  pendingConnectFrom: null,
  contextModuleId: null,
  contextConnection: null,
  aiModalModuleId: null,
  uploadModuleId: null,
  contextProjectId: null,
  dragging: null,
  objectUrls: new Set(),
  published: new Map(),
  preview: { snapshot: null, index: 0, answers: {}, results: {}, pages: {}, timer: null, aiChats: {} },
  teaching: { snapshot: null, currentId: null, history: [], answers: {}, results: {}, pages: {}, aiChats: {} },
};

const dom = {
  switchStudioBtn: document.getElementById("switchStudioBtn"),
  switchTeachingBtn: document.getElementById("switchTeachingBtn"),
  app: document.getElementById("app"),
  teachingSection: document.getElementById("teachingDemoSection"),
  teachingProjectList: document.getElementById("teachingProjectList"),
  teachingPlayerTitle: document.getElementById("teachingPlayerTitle"),
  teachingPlayerStep: document.getElementById("teachingPlayerStep"),
  teachingPlayerArea: document.getElementById("teachingPlayerArea"),
  teachingPrevBtn: document.getElementById("teachingPrevBtn"),
  teachingNextBtn: document.getElementById("teachingNextBtn"),
  userCard: document.getElementById("studioUserCard"),
  createProjectBtn: document.getElementById("createProjectBtn"),
  projectList: document.getElementById("projectList"),
  projectNameDisplay: document.getElementById("projectNameDisplay"),
  projectNameInput: document.getElementById("projectNameInput"),
  saveProjectBtn: document.getElementById("saveProjectBtn"),
  undoBtn: document.getElementById("undoBtn"),
  redoBtn: document.getElementById("redoBtn"),
  createModuleBtn: document.getElementById("createModuleBtn"),
  publishBtn: document.getElementById("publishBtn"),
  previewBtn: document.getElementById("previewBtn"),
  moduleCanvas: document.getElementById("moduleCanvas"),
  connectionLayer: document.getElementById("connectionLayer"),
  canvasEmpty: document.getElementById("canvasEmpty"),
  moduleModal: document.getElementById("moduleModal"),
  moduleForm: document.getElementById("moduleForm"),
  moduleFormMessage: document.getElementById("moduleFormMessage"),
  moduleContentSelect: document.getElementById("moduleContentSelect"),
  moduleNameInput: document.getElementById("moduleNameInput"),
  moduleColorSelect: document.getElementById("moduleColorSelect"),
  moduleShapeSelect: document.getElementById("moduleShapeSelect"),
  moduleModalCancelBtn: document.getElementById("moduleModalCancelBtn"),
  publishModal: document.getElementById("publishModal"),
  publishForm: document.getElementById("publishForm"),
  publishFormMessage: document.getElementById("publishFormMessage"),
  publishCancelBtn: document.getElementById("publishCancelBtn"),
  publishNameInput: document.getElementById("publishNameInput"),
  publishDescriptionInput: document.getElementById("publishDescriptionInput"),
  publishAutoPlay: document.getElementById("publishAutoPlay"),
  publishAutoPlaySeconds: document.getElementById("publishAutoPlaySeconds"),
  previewModal: document.getElementById("previewModal"),
  previewBody: document.getElementById("previewBody"),
  previewProjectTitle: document.getElementById("previewProjectTitle"),
  previewStepInfo: document.getElementById("previewStepInfo"),
  previewAutoPlayToggle: document.getElementById("previewAutoPlayToggle"),
  previewAutoPlaySeconds: document.getElementById("previewAutoPlaySeconds"),
  previewPrevBtn: document.getElementById("previewPrevBtn"),
  previewNextBtn: document.getElementById("previewNextBtn"),
  previewCloseBtn: document.getElementById("previewCloseBtn"),
  contextMenu: document.getElementById("moduleContextMenu"),
  moduleUploadAction: document.getElementById("moduleUploadAction"),
  moduleRenameAction: document.getElementById("moduleRenameAction"),
  moduleAIAssistantAction: document.getElementById("moduleAIAssistantAction"),
  moduleColorPanel: document.getElementById("moduleColorPanel"),
  moduleShapePanel: document.getElementById("moduleShapePanel"),
  moduleDeleteAction: document.getElementById("moduleDeleteAction"),
  moduleUploadInput: document.getElementById("moduleUploadInput"),
  aiAssistantModal: document.getElementById("aiAssistantModal"),
  aiAssistantForm: document.getElementById("aiAssistantForm"),
  aiModelSelect: document.getElementById("aiModelSelect"),
  aiModelHint: document.getElementById("aiModelHint"),
  aiSystemPromptInput: document.getElementById("aiSystemPromptInput"),
  aiKnowledgeInput: document.getElementById("aiKnowledgeInput"),
  aiKnowledgeUploadBtn: document.getElementById("aiKnowledgeUploadBtn"),
  aiKnowledgeUploadInput: document.getElementById("aiKnowledgeUploadInput"),
  aiTestQuestionInput: document.getElementById("aiTestQuestionInput"),
  aiTestBtn: document.getElementById("aiTestBtn"),
  aiTestResponse: document.getElementById("aiTestResponse"),
  aiAssistantMessage: document.getElementById("aiAssistantMessage"),
  aiAssistantCancelBtn: document.getElementById("aiAssistantCancelBtn"),
  connectionContextMenu: document.getElementById("connectionContextMenu"),
  connectionDeleteAction: document.getElementById("connectionDeleteAction"),
  projectContextMenu: document.getElementById("projectContextMenu"),
  projectDuplicateAction: document.getElementById("projectDuplicateAction"),
  projectDeleteAction: document.getElementById("projectDeleteAction"),
};

const escapeHtml = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const now = () => new Date().toISOString();
const contentLabel = (t) => CONTENT_OPTIONS.find((x) => x.key === t)?.label || t;
const needFile = (t) => Boolean(CONTENT_OPTIONS.find((x) => x.key === t)?.needFile);
const curProject = () => state.projects.find((p) => p.id === state.currentProjectId) || null;
const moduleById = (p, id) => p?.modules.find((m) => m.id === Number(id)) || null;
const clampSec = (v, d = 12) => Math.min(600, Math.max(1, Math.floor(Number(v) || d)));
const snap = (v) => GRID_OFFSET + Math.round((Number(v || GRID_OFFSET) - GRID_OFFSET) / GRID_SIZE) * GRID_SIZE;
const emptyAiConfig = () => ({ model: AI_MODEL_OPTIONS[0].value, systemPrompt: "", knowledge: "" });
const getAiConfig = (module) => {
  const raw = module?.compile?.data?.aiConfig || {};
  return {
    model: AI_MODEL_OPTIONS.some((x) => x.value === raw.model) ? raw.model : AI_MODEL_OPTIONS[0].value,
    systemPrompt: String(raw.systemPrompt || ""),
    knowledge: String(raw.knowledge || ""),
  };
};

function showMsg(node, msg = "", err = true) {
  if (!node) return;
  node.textContent = msg;
  node.style.color = msg ? (err ? "#ff9cb7" : "#77f0c6") : "#ff9cb7";
}

function makeProject() {
  state.seq.project += 1;
  const p = { id: state.seq.project, name: `New Project ${state.projects.length + 1}`, description: "", modules: [], connections: [], updatedAt: now() };
  state.projects.unshift(p);
  state.currentProjectId = p.id;
}

function buildSequence(modules, connections) {
  const ids = modules.map((m) => m.id);
  const indeg = new Map(ids.map((id) => [id, 0]));
  connections.forEach((c) => indeg.has(c.toModuleId) && indeg.set(c.toModuleId, indeg.get(c.toModuleId) + 1));
  const q = ids.filter((id) => indeg.get(id) === 0).sort((a, b) => a - b);
  const out = [];
  while (q.length) {
    const id = q.shift();
    out.push(id);
    connections.filter((c) => c.fromModuleId === id).forEach((c) => {
      const v = indeg.get(c.toModuleId) - 1;
      indeg.set(c.toModuleId, v);
      if (v === 0) q.push(c.toModuleId);
    });
    q.sort((a, b) => a - b);
  }
  return out.length === modules.length ? out : ids.slice().sort((a, b) => a - b);
}

const normalizeIso = (v, fallback = now()) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
};

function normalizeModule(raw, fallbackId, index = 0) {
  const contentType = CONTENT_OPTIONS.some((x) => x.key === raw?.contentType) ? raw.contentType : "decision";
  const compileDefault = contentType === "ai_assistant"
    ? { ready: false, summary: "AI Assistant not configured", data: { type: "ai_assistant", aiConfig: emptyAiConfig() } }
    : { ready: !needFile(contentType), summary: needFile(contentType) ? "No file uploaded" : "Logic module ready to connect", data: null };
  const compile = raw?.compile ? JSON.parse(JSON.stringify(raw.compile)) : { ...compileDefault };
  if (typeof compile.ready !== "boolean") compile.ready = Boolean(compile.ready);
  if (!compile.summary) compile.summary = compileDefault.summary;
  if (!Object.prototype.hasOwnProperty.call(compile, "data")) compile.data = null;
  if (compile?.data?.src) compile.data.src = toAssetUrl(compile.data.src);
  if (Array.isArray(compile?.data?.quiz?.questions)) {
    compile.data.quiz.questions = compile.data.quiz.questions.map((q) => ({
      ...q,
      image: q?.image ? toAssetUrl(q.image) : q?.image || "",
    }));
  }
  if (contentType === "ai_assistant") {
    const cfg = getAiConfig({ compile });
    compile.data = { type: "ai_assistant", aiConfig: cfg };
    compile.ready = Boolean(cfg.systemPrompt || cfg.knowledge);
    if (!compile.summary) compile.summary = compile.ready ? "AI Assistant configured" : "AI Assistant not configured";
  }
  const color = COLOR_OPTIONS.includes(raw?.color) ? raw.color : COLOR_OPTIONS[index % COLOR_OPTIONS.length];
  const shape = SHAPE_OPTIONS.includes(raw?.shape) ? raw.shape : SHAPE_OPTIONS[index % SHAPE_OPTIONS.length];
  const px = Math.max(GRID_OFFSET, snap(raw?.positionX ?? GRID_OFFSET + (index % 4) * 240));
  const py = Math.max(GRID_OFFSET, snap(raw?.positionY ?? GRID_OFFSET + Math.floor(index / 4) * 170));
  return {
    id: Number(raw?.id) || fallbackId,
    moduleName: String(raw?.moduleName || `Module ${index + 1}`),
    contentType,
    color,
    shape,
    positionX: px,
    positionY: py,
    file: null,
    compile,
  };
}

function normalizeConnection(raw) {
  const fromModuleId = Number(raw?.fromModuleId);
  const toModuleId = Number(raw?.toModuleId);
  if (!Number.isInteger(fromModuleId) || !Number.isInteger(toModuleId) || fromModuleId === toModuleId) return null;
  return { fromModuleId, toModuleId };
}

function normalizeProject(raw, index = 0) {
  const id = Number(raw?.id) || (1100 + index + 1);
  const modulesRaw = Array.isArray(raw?.modules) ? raw.modules : [];
  const modules = modulesRaw.map((m, i) => normalizeModule(m, id * 10 + i + 1, i));
  const moduleIdSet = new Set(modules.map((m) => m.id));
  const uniq = new Set();
  const connections = (Array.isArray(raw?.connections) ? raw.connections : [])
    .map(normalizeConnection)
    .filter(Boolean)
    .filter((c) => moduleIdSet.has(c.fromModuleId) && moduleIdSet.has(c.toModuleId))
    .filter((c) => {
      const key = `${c.fromModuleId}->${c.toModuleId}`;
      if (uniq.has(key)) return false;
      uniq.add(key);
      return true;
    });
  return {
    id,
    name: String(raw?.name || `Sample Project ${index + 1}`),
    description: String(raw?.description || ""),
    modules,
    connections,
    updatedAt: normalizeIso(raw?.updatedAt),
  };
}

function normalizeSnapshotModule(raw, fallbackId, index = 0) {
  const contentType = CONTENT_OPTIONS.some((x) => x.key === raw?.contentType) ? raw.contentType : "decision";
  const compileDefault = contentType === "ai_assistant"
    ? { ready: false, summary: "AI Assistant not configured", data: { type: "ai_assistant", aiConfig: emptyAiConfig() } }
    : { ready: !needFile(contentType), summary: needFile(contentType) ? "No file uploaded" : "Logic module ready to connect", data: null };
  const compile = raw?.compile ? JSON.parse(JSON.stringify(raw.compile)) : { ...compileDefault };
  if (typeof compile.ready !== "boolean") compile.ready = Boolean(compile.ready);
  if (!compile.summary) compile.summary = compileDefault.summary;
  if (!Object.prototype.hasOwnProperty.call(compile, "data")) compile.data = null;
  if (compile?.data?.src) compile.data.src = toAssetUrl(compile.data.src);
  if (Array.isArray(compile?.data?.quiz?.questions)) {
    compile.data.quiz.questions = compile.data.quiz.questions.map((q) => ({
      ...q,
      image: q?.image ? toAssetUrl(q.image) : q?.image || "",
    }));
  }
  if (contentType === "ai_assistant") {
    const cfg = getAiConfig({ compile });
    compile.data = { type: "ai_assistant", aiConfig: cfg };
    compile.ready = Boolean(cfg.systemPrompt || cfg.knowledge);
    if (!compile.summary) compile.summary = compile.ready ? "AI Assistant configured" : "AI Assistant not configured";
  }
  return {
    id: Number(raw?.id) || fallbackId,
    moduleName: String(raw?.moduleName || `Module ${index + 1}`),
    contentType,
    compile,
  };
}

function normalizeSnapshot(raw, index = 0) {
  const projectId = Number(raw?.projectId) || 0;
  const publishId = Number(raw?.publishId) || (3200 + index + 1);
  const modulesRaw = Array.isArray(raw?.modules) ? raw.modules : [];
  const modules = modulesRaw.map((m, i) => normalizeSnapshotModule(m, publishId * 10 + i + 1, i));
  const moduleIdSet = new Set(modules.map((m) => m.id));
  const uniq = new Set();
  const connections = (Array.isArray(raw?.connections) ? raw.connections : [])
    .map(normalizeConnection)
    .filter(Boolean)
    .filter((c) => moduleIdSet.has(c.fromModuleId) && moduleIdSet.has(c.toModuleId))
    .filter((c) => {
      const key = `${c.fromModuleId}->${c.toModuleId}`;
      if (uniq.has(key)) return false;
      uniq.add(key);
      return true;
    });
  const sequenceRaw = Array.isArray(raw?.sequence) ? raw.sequence.map((x) => Number(x)).filter((id) => moduleIdSet.has(id)) : [];
  const sequence = sequenceRaw.length ? sequenceRaw : buildSequence(modules, connections);
  return {
    projectId,
    publishId,
    name: String(raw?.name || `Sample Course ${index + 1}`),
    description: String(raw?.description || ""),
    publishedAt: normalizeIso(raw?.publishedAt),
    autoPlay: Boolean(raw?.autoPlay),
    autoPlaySeconds: clampSec(raw?.autoPlaySeconds, 12),
    modules,
    connections,
    sequence,
  };
}

function applyBootstrapData(payload) {
  const projects = (Array.isArray(payload?.projects) ? payload.projects : []).map((p, i) => normalizeProject(p, i));
  if (!projects.length) return false;

  const publishedList = (Array.isArray(payload?.published) ? payload.published : []).map((s, i) => normalizeSnapshot(s, i));
  const publishedMap = new Map();
  publishedList.forEach((s) => {
    let pid = Number(s.projectId);
    if (!pid || !projects.some((p) => p.id === pid)) pid = projects[0].id;
    s.projectId = pid;
    publishedMap.set(pid, s);
  });

  state.projects = projects;
  state.published = publishedMap;
  const wanted = Number(payload?.currentProjectId);
  state.currentProjectId = projects.some((p) => p.id === wanted) ? wanted : projects[0].id;

  const projectIds = projects.map((p) => p.id);
  const moduleIds = projects.flatMap((p) => p.modules.map((m) => m.id));
  const publishedModuleIds = [...publishedMap.values()].flatMap((s) => s.modules.map((m) => m.id));
  const publishIds = [...publishedMap.values()].map((s) => Number(s.publishId) || 0);
  state.seq.project = Math.max(1000, ...projectIds);
  state.seq.module = Math.max(2000, ...moduleIds, ...publishedModuleIds);
  state.seq.publish = Math.max(3000, ...publishIds);
  return true;
}

async function loadBootstrapData() {
  if (typeof window.fetch !== "function") return false;
  try {
    const res = await fetch(apiUrl("/api/bootstrap"), { cache: "no-store" });
    if (!res.ok) return false;
    const data = await res.json();
    return applyBootstrapData(data);
  } catch {
    return false;
  }
}

const isBlobUrl = (src) => typeof src === "string" && src.startsWith("blob:");
const isPersistableSrc = (src) => typeof src === "string" && (src.startsWith("/") || /^https?:\/\//i.test(src));

function revokeBlobUrl(src) {
  if (!isBlobUrl(src)) return;
  try { URL.revokeObjectURL(src); } catch {}
}

async function uploadFileToServer(file, contentType) {
  if (typeof window.fetch !== "function") throw new Error("This environment does not support the upload API");
  const name = encodeURIComponent(String(file.name || "upload.bin"));
  const type = encodeURIComponent(String(contentType || ""));
  let res;
  try {
    res = await fetch(apiUrl(`/api/upload?name=${name}&contentType=${type}`), {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
  } catch {
    throw new Error("Could not connect to the backend. Start it with start_server.bat or node server.js, then open http://localhost:5173");
  }
  if (!res.ok) {
    let msg = "Upload failed";
    try { const d = await res.json(); if (d?.error) msg = d.error; } catch {}
    throw new Error(msg);
  }
  const data = await res.json();
  if (!data?.url) throw new Error("Upload failed: the backend did not return a file URL");
  return {
    src: toAssetUrl(data.url),
    originalName: String(data.originalName || file.name || ""),
    mimeType: String(file.type || ""),
  };
}

async function uploadKnowledgeFileToServer(file) {
  if (typeof window.fetch !== "function") throw new Error("This environment does not support the upload API");
  const name = encodeURIComponent(String(file.name || "knowledge.bin"));
  let res;
  try {
    res = await fetch(apiUrl(`/api/ai/knowledge-upload?name=${name}`), {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
  } catch {
    throw new Error("Could not connect to the backend. Start server.js first.");
  }
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(String(data?.error || "Knowledge base upload failed"));
  return {
    url: toAssetUrl(data.url || ""),
    text: String(data.knowledgeText || ""),
    originalName: String(data.originalName || file.name || ""),
  };
}

function sanitizeCompileForStorage(contentType, compile) {
  if (!compile) return null;
  if (contentType === "quiz") {
    const quiz = compile?.data?.quiz;
    if (quiz && Array.isArray(quiz.questions)) {
      return {
        ready: true,
        summary: compile.summary || `Compiled: ${quiz.questions.length} questions`,
        data: { type: "quiz", quiz: JSON.parse(JSON.stringify(quiz)) },
      };
    }
    return { ready: false, summary: "No file uploaded", data: null };
  }
  if (contentType === "decision" || contentType === "merge") {
    return { ready: true, summary: compile.summary || "Logic module ready", data: { type: contentType } };
  }
  if (contentType === "ai_assistant") {
    const cfg = getAiConfig({ compile });
    const ready = Boolean(cfg.systemPrompt || cfg.knowledge);
    return {
      ready,
      summary: ready ? "AI Assistant configured" : "AI Assistant not configured",
      data: { type: "ai_assistant", aiConfig: cfg },
    };
  }
  if (["ppt", "video", "interactive"].includes(contentType) && compile.ready && isPersistableSrc(compile?.data?.src)) {
    const data = { type: contentType, src: String(compile.data.src) };
    if (contentType === "ppt") data.pages = Math.max(1, Number(compile?.data?.pages || 1));
    if (contentType === "video") data.duration = Number(compile?.data?.duration || 0);
    return { ready: true, summary: String(compile.summary || "Compiled"), data };
  }
  return { ready: false, summary: "Please re-upload the file", data: null };
}

function sanitizeProjectForStorage(project) {
  return {
    id: Number(project.id),
    name: String(project.name || ""),
    description: String(project.description || ""),
    updatedAt: normalizeIso(project.updatedAt),
    modules: (project.modules || []).map((m) => ({
      id: Number(m.id),
      moduleName: String(m.moduleName || ""),
      contentType: m.contentType,
      color: m.color,
      shape: m.shape,
      positionX: Number(m.positionX || GRID_OFFSET),
      positionY: Number(m.positionY || GRID_OFFSET),
      compile: sanitizeCompileForStorage(m.contentType, m.compile),
    })),
    connections: (project.connections || []).map((c) => ({
      fromModuleId: Number(c.fromModuleId),
      toModuleId: Number(c.toModuleId),
    })),
  };
}

function sanitizeSnapshotForStorage(snapshot) {
  return {
    projectId: Number(snapshot.projectId),
    publishId: Number(snapshot.publishId),
    name: String(snapshot.name || ""),
    description: String(snapshot.description || ""),
    publishedAt: normalizeIso(snapshot.publishedAt),
    autoPlay: Boolean(snapshot.autoPlay),
    autoPlaySeconds: clampSec(snapshot.autoPlaySeconds, 12),
    modules: (snapshot.modules || []).map((m) => ({
      id: Number(m.id),
      moduleName: String(m.moduleName || ""),
      contentType: m.contentType,
      compile: sanitizeCompileForStorage(m.contentType, m.compile),
    })),
    connections: (snapshot.connections || []).map((c) => ({
      fromModuleId: Number(c.fromModuleId),
      toModuleId: Number(c.toModuleId),
    })),
    sequence: (snapshot.sequence || []).map((x) => Number(x)).filter((x) => Number.isInteger(x)),
  };
}

function persistLocalState() {
  try {
    if (!window.localStorage) return;
    const payload = {
      currentProjectId: state.currentProjectId,
      projects: state.projects.map((p) => sanitizeProjectForStorage(p)),
      published: [...state.published.values()].map((s) => sanitizeSnapshotForStorage(s)),
      savedAt: now(),
    };
    window.localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(payload));
  } catch {}
}

function loadLocalState() {
  try {
    if (!window.localStorage) return false;
    const raw = window.localStorage.getItem(LOCAL_STATE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return applyBootstrapData(data);
  } catch {
    return false;
  }
}

function shouldForceBootstrap() {
  try {
    const params = new URLSearchParams(window.location.search || "");
    return ["1", "true", "yes"].includes(String(params.get("reset") || "").toLowerCase())
      || ["1", "true", "yes"].includes(String(params.get("forceBootstrap") || "").toLowerCase());
  } catch {
    return false;
  }
}

function clearWorkspaceLocalState() {
  try {
    if (!window.localStorage) return;
    window.localStorage.removeItem(LOCAL_STATE_KEY);
  } catch {}
}

function clearLegacyLocalStateKeys() {
  try {
    if (!window.localStorage) return;
    LEGACY_LOCAL_STATE_KEYS.forEach((k) => {
      try { window.localStorage.removeItem(k); } catch {}
    });
  } catch {}
}

function nextIds(snapshot, moduleId) {
  const direct = snapshot.connections.filter((c) => c.fromModuleId === Number(moduleId)).map((c) => c.toModuleId);
  if (direct.length) return direct;
  const i = snapshot.sequence.indexOf(Number(moduleId));
  return i >= 0 && i < snapshot.sequence.length - 1 ? [snapshot.sequence[i + 1]] : [];
}

function playableModuleIds(snapshot) {
  return (snapshot?.sequence || []).filter((id) => {
    const m = snapshot.modules.find((x) => x.id === Number(id));
    return m && m.contentType !== "ai_assistant";
  });
}

function nextPlayableIds(snapshot, moduleId) {
  const out = [];
  nextIds(snapshot, moduleId).forEach((id) => {
    const m = snapshot.modules.find((x) => x.id === Number(id));
    if (!m) return;
    if (m.contentType === "ai_assistant") {
      nextIds(snapshot, m.id).forEach((nextId) => {
        const next = snapshot.modules.find((x) => x.id === Number(nextId));
        if (next && next.contentType !== "ai_assistant") out.push(next.id);
      });
    } else {
      out.push(m.id);
    }
  });
  return [...new Set(out)];
}

function attachedAiModule(snapshot, moduleId) {
  const direct = nextIds(snapshot, moduleId)
    .map((id) => snapshot.modules.find((x) => x.id === Number(id)))
    .filter(Boolean);
  return direct.find((m) => m.contentType === "ai_assistant") || null;
}

function ownerModuleForAi(snapshot, aiModuleId) {
  const directOwner = (snapshot.modules || []).find((m) =>
    m.contentType !== "ai_assistant"
    && nextIds(snapshot, m.id).some((id) => Number(id) === Number(aiModuleId)));
  if (directOwner) return directOwner;
  const idx = snapshot.sequence.indexOf(Number(aiModuleId));
  for (let i = idx - 1; i >= 0; i -= 1) {
    const m = snapshot.modules.find((x) => x.id === Number(snapshot.sequence[i]));
    if (m && m.contentType !== "ai_assistant") return m;
  }
  return null;
}

function updateCanvasSize(p) {
  let w = 1400;
  let h = 800;
  (p?.modules || []).forEach((m) => {
    w = Math.max(w, Number(m.positionX || GRID_OFFSET) + NODE_WIDTH + 120);
    h = Math.max(h, Number(m.positionY || GRID_OFFSET) + NODE_HEIGHT + 120);
  });
  dom.moduleCanvas.style.width = `${w}px`;
  dom.moduleCanvas.style.height = `${h}px`;
  dom.connectionLayer.setAttribute("width", String(w));
  dom.connectionLayer.setAttribute("height", String(h));
}

function center(p, moduleId, side) {
  const m = moduleById(p, moduleId);
  if (!m) return null;
  const size = {
    circle: { w: 210, h: 210 },
    diamond: { w: 260, h: 190 },
    hex: { w: 260, h: 178 },
  }[m.shape] || { w: NODE_WIDTH, h: NODE_HEIGHT };
  const w = size.w;
  const h = size.h;
  const x = Number(m.positionX || GRID_OFFSET);
  const y = Number(m.positionY || GRID_OFFSET);
  if (side === "left") return { x, y: y + h / 2 };
  return { x: x + w, y: y + h / 2 };
}

function drawConnections(p) {
  const defs = dom.connectionLayer.querySelector("defs");
  dom.connectionLayer.innerHTML = "";
  if (defs) dom.connectionLayer.appendChild(defs);
  (p?.connections || []).forEach((c) => {
    const from = center(p, c.fromModuleId, "right");
    const to = center(p, c.toModuleId, "left");
    if (!from || !to) return;
    const dx = Math.max(40, (to.x - from.x) * 0.35);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`);
    const selected = state.contextConnection
      && Number(state.contextConnection.fromModuleId) === Number(c.fromModuleId)
      && Number(state.contextConnection.toModuleId) === Number(c.toModuleId);
    if (selected) path.classList.add("is-selected");
    path.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeModuleMenu();
      dom.projectContextMenu.classList.add("hidden");
      openConnectionMenu(e.clientX, e.clientY, c);
      drawConnections(p);
    });
    dom.connectionLayer.appendChild(path);
  });
}

function renderProjects() {
  dom.projectList.innerHTML = state.projects.map((p) => {
    const active = p.id === state.currentProjectId ? "active" : "";
    const pub = state.published.has(p.id) ? "Published" : "Unpublished";
    return `<article class="studio-project-item ${active}" data-project-id="${p.id}"><div class="studio-project-item-title">${escapeHtml(p.name)}</div><div class="studio-project-item-meta">${pub} · ${new Date(p.updatedAt).toLocaleString()}</div></article>`;
  }).join("") || '<div class="muted-text">No projects yet</div>';
}

function renderName() {
  const p = curProject();
  dom.projectNameDisplay.textContent = p ? p.name : "No project selected";
}

function renderNodeMenus(m) {
  dom.moduleColorPanel.innerHTML = COLOR_OPTIONS.map((c) => `<button type="button" data-color="${c}" class="${m?.color===c?"is-active":""}">${c}</button>`).join("");
  dom.moduleShapePanel.innerHTML = SHAPE_OPTIONS.map((s) => `<button type="button" data-shape="${s}" class="${m?.shape===s?"is-active":""}">${s}</button>`).join("");
}

function closeModuleMenu() {
  dom.contextMenu.classList.add("hidden");
  state.contextModuleId = null;
}

function closeConnectionMenu(redraw = false) {
  dom.connectionContextMenu?.classList.add("hidden");
  if (!state.contextConnection) return;
  state.contextConnection = null;
  if (!redraw) return;
  const p = curProject();
  if (p) drawConnections(p);
}

function openConnectionMenu(clientX, clientY, connection) {
  if (!dom.connectionContextMenu) return;
  state.contextConnection = {
    fromModuleId: Number(connection.fromModuleId),
    toModuleId: Number(connection.toModuleId),
  };
  const menu = dom.connectionContextMenu;
  menu.style.left = `${clientX}px`;
  menu.style.top = `${clientY}px`;
  menu.classList.remove("hidden");
  const rect = menu.getBoundingClientRect();
  const left = Math.min(window.innerWidth - rect.width - 8, Math.max(8, clientX));
  const top = Math.min(window.innerHeight - rect.height - 8, Math.max(8, clientY));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function isFullscreenActive() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

function enterTeachingFullscreen() {
  document.body.classList.add("teaching-fullscreen-mode");
  const root = document.documentElement;
  const req = root.requestFullscreen || root.webkitRequestFullscreen;
  if (!req || isFullscreenActive()) return;
  Promise.resolve(req.call(root)).catch(() => {
    document.body.classList.remove("teaching-fullscreen-mode");
  });
}

function closeAiAssistantModal() {
  dom.aiAssistantModal.classList.add("hidden");
  state.aiModalModuleId = null;
  showMsg(dom.aiAssistantMessage, "");
  dom.aiTestResponse.textContent = "";
}

function updateAiModelHint() {
  const opt = AI_MODEL_OPTIONS.find((x) => x.value === dom.aiModelSelect.value) || AI_MODEL_OPTIONS[0];
  dom.aiModelHint.textContent = opt.hint;
}

function openAiAssistantModal(module) {
  if (!module) return;
  const cfg = getAiConfig(module);
  state.aiModalModuleId = module.id;
  dom.aiModelSelect.value = cfg.model;
  dom.aiSystemPromptInput.value = cfg.systemPrompt;
  dom.aiKnowledgeInput.value = cfg.knowledge;
  dom.aiTestQuestionInput.value = "";
  dom.aiTestResponse.textContent = "";
  showMsg(dom.aiAssistantMessage, "");
  updateAiModelHint();
  dom.aiAssistantModal.classList.remove("hidden");
}

function sanitizeKnowledgeText(rawText, fileName = "") {
  const text = String(rawText || "").replace(/\u0000/g, " ").trim();
  if (!text) return "";
  const compact = text.replace(/\s+/g, "");
  const total = Math.max(1, compact.length);
  const latinExtended = (compact.match(/[\u00C0-\u024F]/g) || []).length;
  const mojibakeMarks = (compact.match(/[ÃÂÐÑÞæçèéêëìíîïðñòóôõöøùúûüýþ]/g) || []).length;
  const likelyMojibake = latinExtended / total > 0.12 || mojibakeMarks >= 12;
  if (likelyMojibake) {
    if (/\.xls$/i.test(String(fileName || ""))) {
      return "[The parsed .xls content looks garbled. Please save it as .xlsx and upload it again.]";
    }
    return "[The uploaded content looks garbled. Please retry with UTF-8 text or an .xlsx file.]";
  }
  const noiseWords = [
    "root entry",
    "workbook",
    "summaryinformation",
    "documentsummaryinformation",
    "microsoft excel",
    "worksheet",
    "styles",
    "font",
  ];
  const lines = text
    .split(/\r?\n/)
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((x) => x.length >= 2 && x.length <= 220)
    .filter((x) => /[\u4e00-\u9fa5a-zA-Z0-9]{6,}/.test(x))
    .filter((x) => ((x.match(/\s/g) || []).length / Math.max(1, x.length)) < 0.24)
    .filter((x) => !noiseWords.some((w) => x.toLowerCase().includes(w)))
    .filter((x) => {
      const cjk = (x.match(/[\u4e00-\u9fa5]/g) || []).length;
      const words = (x.match(/[a-zA-Z]{3,}/g) || []).length;
      return cjk >= 2 || words >= 2;
    });
  const merged = [...new Set(lines)].slice(0, 500).join("\n");
  if (merged) return merged.slice(0, 160000);
  if (/\.xls$/i.test(String(fileName || "")) || /root entry|workbook/i.test(text)) {
    return "[The parsed .xls content looks garbled. Please save it as .xlsx and upload it again.]";
  }
  return text.slice(0, 160000);
}

async function appendKnowledgeByFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const blocks = [];
  for (const f of files) {
    const uploaded = await uploadKnowledgeFileToServer(f);
    const name = uploaded.originalName || String(f.name || "knowledge");
    const urlText = uploaded.url ? `\n[Backend file] ${uploaded.url}` : "";
    const content = sanitizeKnowledgeText(uploaded.text, name);
    blocks.push(`\n\n# File: ${name}${urlText}\n${content || "[No text content was extracted]"}`);
  }
  dom.aiKnowledgeInput.value = `${dom.aiKnowledgeInput.value || ""}${blocks.join("")}`;
}

function applyAiConfigToModule(module, cfg) {
  const merged = {
    model: AI_MODEL_OPTIONS.some((x) => x.value === cfg.model) ? cfg.model : AI_MODEL_OPTIONS[0].value,
    systemPrompt: String(cfg.systemPrompt || "").trim(),
    knowledge: String(cfg.knowledge || "").trim(),
  };
  const ready = Boolean(merged.systemPrompt || merged.knowledge);
  module.compile = {
    ready,
    summary: ready ? "AI Assistant configured" : "AI Assistant not configured",
    data: { type: "ai_assistant", aiConfig: merged },
  };
}

function renderCanvas() {
  const p = curProject();
  dom.moduleCanvas.innerHTML = "";
  dom.canvasEmpty.classList.toggle("hidden", Boolean(p?.modules?.length));
  if (!p) return;
  p.modules.forEach((m) => {
    const ready = Boolean(m.compile?.ready);
    const status = m.compile?.summary || (needFile(m.contentType) ? "No file uploaded" : "Logic module");
    const node = document.createElement("article");
    node.className = "studio-node";
    node.dataset.moduleId = String(m.id);
    node.dataset.shape = m.shape;
    node.style.left = `${m.positionX}px`;
    node.style.top = `${m.positionY}px`;
    node.style.setProperty("--node-border", `${m.color}99`);
    node.innerHTML = `
      <div class="studio-node-head"><div class="studio-node-title">${escapeHtml(m.moduleName)}</div><div class="studio-node-dot" style="background:${m.color}"></div></div>
      <div class="studio-node-sub">${escapeHtml(contentLabel(m.contentType))}</div>
      <div class="studio-node-status ${ready?"ready":"pending"}">${escapeHtml(status)}</div>
      <button class="studio-node-play" type="button">${m.contentType === "ai_assistant" ? "Open Chat" : "Play"}</button>
      <button class="node-handle left" type="button">+</button>
      <button class="node-handle right" type="button">+</button>
    `;

    node.querySelector(".studio-node-play").addEventListener("click", (e) => {
      e.stopPropagation();
      openPreview(m.id);
    });

    node.querySelector(".node-handle.right").addEventListener("click", (e) => {
      e.stopPropagation();
      state.pendingConnectFrom = m.id;
      showMsg(dom.moduleFormMessage, `Start selected: ${m.moduleName}. Click + on the left side of the target module.`, false);
    });

    node.querySelector(".node-handle.left").addEventListener("click", (e) => {
      e.stopPropagation();
      if (!state.pendingConnectFrom) return;
      if (state.pendingConnectFrom !== m.id && !p.connections.some((c) => c.fromModuleId===state.pendingConnectFrom && c.toModuleId===m.id)) {
        p.connections.push({ fromModuleId: state.pendingConnectFrom, toModuleId: m.id });
        p.updatedAt = now();
      }
      state.pendingConnectFrom = null;
      drawConnections(p);
      persistLocalState();
    });

    node.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      closeConnectionMenu(true);
      state.contextModuleId = m.id;
      renderNodeMenus(m);
      dom.contextMenu.style.left = `${e.clientX}px`;
      dom.contextMenu.style.top = `${e.clientY}px`;
      dom.contextMenu.classList.remove("hidden");
    });

    node.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (e.target.closest(".node-handle") || e.target.closest(".studio-node-play")) return;
      state.dragging = { id: m.id, pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, ox: m.positionX, oy: m.positionY };
      node.classList.add("dragging");
      node.setPointerCapture(e.pointerId);
    });

    node.addEventListener("pointermove", (e) => {
      if (!state.dragging || state.dragging.pointerId !== e.pointerId) return;
      const d = state.dragging;
      const tm = moduleById(p, d.id);
      if (!tm) return;
      tm.positionX = Math.max(GRID_OFFSET, snap(d.ox + (e.clientX - d.sx)));
      tm.positionY = Math.max(GRID_OFFSET, snap(d.oy + (e.clientY - d.sy)));
      node.style.left = `${tm.positionX}px`;
      node.style.top = `${tm.positionY}px`;
      updateCanvasSize(p);
      drawConnections(p);
    });

    const finish = (e) => {
      if (!state.dragging || state.dragging.pointerId !== e.pointerId) return;
      state.dragging = null;
      node.classList.remove("dragging");
      if (node.hasPointerCapture(e.pointerId)) node.releasePointerCapture(e.pointerId);
      p.updatedAt = now();
      persistLocalState();
    };
    node.addEventListener("pointerup", finish);
    node.addEventListener("pointercancel", finish);

    dom.moduleCanvas.appendChild(node);
  });

  updateCanvasSize(p);
  drawConnections(p);
}

function rerenderStudio() {
  renderProjects();
  renderName();
  renderCanvas();
  persistLocalState();
}

function parseCsv(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let q = false;
  const src = String(text || "").replace(/\r\n/g, "\n");
  for (let i=0;i<src.length;i+=1) {
    const ch = src[i];
    if (ch === '"') {
      if (q && src[i+1] === '"') { cell += '"'; i += 1; } else { q = !q; }
      continue;
    }
    if (!q && ch === delimiter) { row.push(cell.trim()); cell = ""; continue; }
    if (!q && ch === "\n") { row.push(cell.trim()); cell = ""; if (row.some((x)=>x!=="")) rows.push(row); row=[]; continue; }
    cell += ch;
  }
  row.push(cell.trim());
  if (row.some((x)=>x!=="")) rows.push(row);
  return rows;
}

function normalizeQuizType(raw) {
  const t = String(raw || "").trim().toLowerCase();
  if (["single","radio","\u5355\u9009"].includes(t)) return "single";
  if (["multiple","checkbox","\u591a\u9009"].includes(t)) return "multiple";
  if (["scale","likert","\u91cf\u8868"].includes(t)) return "scale";
  return "blank";
}

async function parseQuizByServer(file) {
  if (typeof window.fetch !== "function") throw new Error("This environment does not support the quiz parsing API");
  const name = encodeURIComponent(String(file.name || "quiz.zip"));
  let res;
  try {
    res = await fetch(apiUrl(`/api/quiz-parse?name=${name}`), {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
  } catch {
    throw new Error("Could not connect to the backend. Start it with start_server.bat or node server.js, then open http://localhost:5173");
  }
  if (!res.ok) {
    let msg = "Quiz parsing failed";
    try { const d = await res.json(); if (d?.error) msg = d.error; } catch {}
    throw new Error(msg);
  }
  const data = await res.json();
  const quiz = data?.quiz || data;
  if (!quiz?.questions || !Array.isArray(quiz.questions) || !quiz.questions.length) {
    throw new Error("Quiz parsing failed: no valid questions were returned");
  }
  return {
    title: String(quiz.title || String(file.name || "Quiz").replace(/\.[^.]+$/, "")),
    questions: quiz.questions.map((q, i) => ({
      id: String(q.id || `q${i + 1}`),
      type: normalizeQuizType(q.type || q.questionType),
      prompt: String(q.prompt || q.question || "").trim(),
      options: Array.isArray(q.options)
        ? q.options.map((x) => String(x).trim()).filter(Boolean)
        : String(q.options || "").split(/\||\n/).map((x) => x.trim()).filter(Boolean),
      answer: q.answer ?? "",
      image: q.image ? toAssetUrl(q.image) : "",
    })).filter((q) => q.prompt),
  };
}

async function parseQuiz(file) {
  const ext = String(file.name || "").toLowerCase().split(".").pop();
  const title = String(file.name || "Quiz").replace(/\.[^.]+$/, "");
  if (ext === "zip" || ext === "xlsx") {
    return parseQuizByServer(file);
  }
  if (ext === "json") {
    const raw = JSON.parse(await file.text());
    const source = Array.isArray(raw) ? raw : raw.questions || [];
    const questions = source.map((q, i) => ({ id: String(q.id || `q${i+1}`), type: normalizeQuizType(q.type || q.questionType), prompt: String(q.prompt || q.question || "").trim(), options: String(q.options || "").split(/\||\n/).map((x)=>x.trim()).filter(Boolean), answer: q.answer ?? "", image: q.image ? String(q.image) : "" })).filter((q) => q.prompt);
    if (!questions.length) throw new Error("The JSON file does not contain any valid questions");
    return { title, questions };
  }
  const text = await file.text();
  const delimiter = ext === "tsv" ? "\t" : ((text.split(/\r?\n/)[0] || "").includes("\t") ? "\t" : ",");
  const rows = parseCsv(text, delimiter);
  if (rows.length < 2) throw new Error("CSV/TSV requires at least a header row and one question row");
  const header = rows[0];
  const questions = rows.slice(1).map((line, i) => {
    const row = {};
    header.forEach((h, idx) => { row[String(h || "").trim()] = line[idx] || ""; });
    return { id: String(row.id || `q${i+1}`), type: normalizeQuizType(row.type || row.questionType), prompt: String(row.question || row.prompt || "").trim(), options: String(row.options || "").split(/\||\n/).map((x)=>x.trim()).filter(Boolean), answer: row.answer || "", image: row.image ? String(row.image) : "" };
  }).filter((q) => q.prompt);
  if (!questions.length) throw new Error("No valid questions were parsed");
  return { title, questions };
}

async function compileModule(project, m, file = m.file?.raw || null) {
  if (!needFile(m.contentType)) {
    if (m.contentType === "ai_assistant") {
      const cfg = getAiConfig(m);
      const ready = Boolean(cfg.systemPrompt || cfg.knowledge);
      m.compile = {
        ready,
        summary: ready ? "AI Assistant configured" : "AI Assistant not configured",
        data: { type: "ai_assistant", aiConfig: cfg },
      };
    } else {
      m.compile = { ready: true, summary: "Logic module ready", data: { type: m.contentType } };
    }
    project.updatedAt = now();
    return;
  }
  if (!file) throw new Error(`Module "${m.moduleName}" has no uploaded file`);

  const prevSrc = m.file?.src;
  const preferServerUpload = ["ppt", "video", "interactive"].includes(m.contentType);
  let src = "";
  let usedServer = false;

  if (preferServerUpload) {
    try {
      const uploaded = await uploadFileToServer(file, m.contentType);
      src = uploaded.src;
      m.file = { raw: null, src, originalName: uploaded.originalName, mimeType: uploaded.mimeType };
      usedServer = true;
      revokeBlobUrl(prevSrc);
    } catch (err) {
      src = URL.createObjectURL(file);
      state.objectUrls.add(src);
      m.file = { raw: file, src, originalName: file.name, mimeType: file.type || "" };
      revokeBlobUrl(prevSrc);
      console.warn("upload failed, fallback to blob url", err);
    }
  } else {
    src = URL.createObjectURL(file);
    state.objectUrls.add(src);
    m.file = { raw: file, src, originalName: file.name, mimeType: file.type || "" };
    revokeBlobUrl(prevSrc);
  }

  if (m.contentType === "ppt") {
    let pages = 1;
    if (String(file.name || "").toLowerCase().endsWith(".pdf")) {
      try { pages = Math.max(1, ((await file.slice(0, Math.min(file.size, 2 * 1024 * 1024)).text()).match(/\/Type\s*\/Page\b/g) || []).length || 1); } catch {}
    }
    const suffix = usedServer ? "" : " (valid for this session)";
    m.compile = { ready: true, summary: `Compiled: ${file.name} (about ${pages} pages)${suffix}`, data: { type: "ppt", src, pages } };
  } else if (m.contentType === "video") {
    const duration = await new Promise((resolve) => {
      const v = document.createElement("video");
      let done = false;
      const finish = (x) => { if (!done) { done = true; resolve(x); } };
      v.preload = "metadata";
      v.onloadedmetadata = () => finish(Number(v.duration) || 0);
      v.onerror = () => finish(0);
      setTimeout(() => finish(0), 5000);
      v.src = src;
    });
    const suffix = usedServer ? "" : " (valid for this session)";
    m.compile = { ready: true, summary: `Compiled: ${file.name} (${duration ? duration.toFixed(1) : "unknown"} seconds)${suffix}`, data: { type: "video", src, duration } };
  } else if (m.contentType === "interactive") {
    const ext = String(file.name || "").toLowerCase().split(".").pop();
    if (!["html", "htm"].includes(ext)) throw new Error("Interactive modules only support HTML/HTM files");
    const suffix = usedServer ? "" : " (valid for this session)";
    m.compile = { ready: true, summary: `Compiled: ${file.name}${suffix}`, data: { type: "interactive", src } };
  } else if (m.contentType === "quiz") {
    const quiz = await parseQuiz(file);
    m.compile = { ready: true, summary: `Compiled: ${quiz.questions.length} questions`, data: { type: "quiz", quiz } };
  }
  project.updatedAt = now();
}

function snapshotOf(project, meta) {
  return {
    projectId: project.id,
    publishId: meta.publishId,
    name: meta.name,
    description: meta.description,
    publishedAt: meta.publishedAt,
    autoPlay: meta.autoPlay,
    autoPlaySeconds: meta.autoPlaySeconds,
    modules: project.modules.map((m) => ({ id: m.id, moduleName: m.moduleName, contentType: m.contentType, compile: m.compile ? JSON.parse(JSON.stringify(m.compile)) : null })),
    connections: project.connections.map((c) => ({ ...c })),
    sequence: buildSequence(project.modules, project.connections),
  };
}

function firstId(snapshot) { return playableModuleIds(snapshot)[0] || snapshot.sequence[0] || snapshot.modules[0]?.id || null; }

function renderQuiz(container, module, answersBag, resultBag, key) {
  const quiz = module.compile?.data?.quiz;
  const qs = quiz?.questions || [];
  answersBag[module.id] ||= {};
  const ans = answersBag[module.id];
  const result = resultBag[module.id] || "";
  if (!qs.length) { container.innerHTML = '<div class="studio-preview-empty">This quiz has no available questions.</div>'; return; }
  const html = qs.map((q, i) => {
    const id = String(q.id || `q${i+1}`);
    const val = ans[id];
    const img = q.image ? `<div class="quiz-image-wrap"><img src="${escapeHtml(q.image)}" alt="Question image" /></div>` : "";
    if (q.type === "single") {
      const opts = (q.options || []).map((o) => `<label class="quiz-option-line"><input type="radio" name="${key}_${module.id}_${id}" value="${escapeHtml(o)}" data-qt="single" data-mid="${module.id}" data-qid="${escapeHtml(id)}" ${String(val||"")===String(o)?"checked":""}/> <span class="quiz-option-text">${escapeHtml(o)}</span></label>`).join("");
      return `<article class="quiz-question"><div class="quiz-question-title">${i+1}. ${escapeHtml(q.prompt)}</div><div class="quiz-question-body">${img}${opts}</div></article>`;
    }
    if (q.type === "multiple") {
      const set = new Set(Array.isArray(val) ? val : []);
      const opts = (q.options || []).map((o) => `<label class="quiz-option-line"><input type="checkbox" value="${escapeHtml(o)}" data-qt="multiple" data-mid="${module.id}" data-qid="${escapeHtml(id)}" ${set.has(String(o))?"checked":""}/> <span class="quiz-option-text">${escapeHtml(o)}</span></label>`).join("");
      return `<article class="quiz-question"><div class="quiz-question-title">${i+1}. ${escapeHtml(q.prompt)}</div><div class="quiz-question-body">${img}${opts}</div></article>`;
    }
    if (q.type === "scale") {
      const opts = [1,2,3,4,5].map((n) => `<label class="quiz-option-line"><input type="radio" name="${key}_${module.id}_${id}" value="${n}" data-qt="scale" data-mid="${module.id}" data-qid="${escapeHtml(id)}" ${Number(val)===n?"checked":""}/> <span class="quiz-option-text">${n}</span></label>`).join("");
      return `<article class="quiz-question"><div class="quiz-question-title">${i+1}. ${escapeHtml(q.prompt)}</div><div class="quiz-question-body">${img}${opts}</div></article>`;
    }
    return `<article class="quiz-question"><div class="quiz-question-title">${i+1}. ${escapeHtml(q.prompt)}</div><div class="quiz-question-body">${img}<textarea class="quiz-textarea" data-qt="text" data-mid="${module.id}" data-qid="${escapeHtml(id)}">${escapeHtml(val || "")}</textarea></div></article>`;
  }).join("");
  container.innerHTML = `<div class="quiz-player"><div class="quiz-player-head"><h3>${escapeHtml(quiz.title || module.moduleName)}</h3></div><div class="quiz-form">${html}</div><div class="quiz-actions" style="margin-top:12px;"><button class="primary-btn" type="button" data-qsubmit="${key}" data-mid="${module.id}">Submit Quiz</button><span class="quiz-status">${escapeHtml(result)}</span></div></div>`;
}

function scoreQuiz(module, answers) {
  const qs = module.compile?.data?.quiz?.questions || [];
  let s = 0; let t = 0;
  qs.forEach((q) => {
    if (q.answer == null || q.answer === "") return;
    t += 1;
    const v = answers[String(q.id)];
    if (q.type === "multiple") {
      const e = String(q.answer).split(/\||,/).map((x)=>x.trim()).filter(Boolean).sort().join("|");
      const a = [...(Array.isArray(v)?v:[])].map(String).sort().join("|");
      if (e === a) s += 1;
    } else if (q.type === "scale") {
      if (Number(v) === Number(q.answer)) s += 1;
    } else if (String(v||"").trim().toLowerCase() === String(q.answer||"").trim().toLowerCase()) {
      s += 1;
    }
  });
  return t ? `Submitted: ${s} / ${t}` : "Submitted (no answer key)";
}
function aiChatBag(mode) {
  return mode === "preview" ? state.preview.aiChats : state.teaching.aiChats;
}

function normalizePdfSrc(srcBase) {
  return String(toAssetUrl(srcBase || "")).split("#")[0];
}

function loadScriptOnce(url) {
  return new Promise((resolve, reject) => {
    const exists = [...document.getElementsByTagName("script")].find((s) => s.src === url);
    if (exists) {
      if (exists.dataset.loaded === "1") return resolve();
      exists.addEventListener("load", () => resolve(), { once: true });
      exists.addEventListener("error", () => reject(new Error(`Failed to load script: ${url}`)), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "1";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
    document.head.appendChild(script);
  });
}

async function ensurePdfJsReady() {
  if (!pdfRuntime.scriptPromise) {
    pdfRuntime.scriptPromise = (async () => {
      if (!window.pdfjsLib) await loadScriptOnce(PDFJS_SCRIPT_URL);
      if (!window.pdfjsLib) throw new Error("pdf.js is unavailable");
      if (window.pdfjsLib.GlobalWorkerOptions) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      }
      return window.pdfjsLib;
    })().catch((err) => {
      pdfRuntime.scriptPromise = null;
      throw err;
    });
  }
  return pdfRuntime.scriptPromise;
}

async function getPdfDocument(srcBase) {
  const src = normalizePdfSrc(srcBase);
  if (!src) throw new Error("PDF source is empty");
  const cached = pdfRuntime.docs.get(src);
  if (cached?.doc) return cached.doc;
  if (cached?.promise) return cached.promise;
  const promise = (async () => {
    const lib = await ensurePdfJsReady();
    const task = lib.getDocument({ url: src });
    const doc = await task.promise;
    pdfRuntime.docs.set(src, { doc });
    return doc;
  })().catch((err) => {
    pdfRuntime.docs.delete(src);
    throw err;
  });
  pdfRuntime.docs.set(src, { promise });
  return promise;
}

function getKnownPdfPageCount(srcBase, fallbackPages = 1) {
  const src = normalizePdfSrc(srcBase);
  const known = Number(pdfRuntime.docs.get(src)?.doc?.numPages || 0);
  if (known > 0) return known;
  return Math.max(1, Number(fallbackPages || 1));
}

async function renderPdfPageCanvas(playerEl, srcBase, page, maxHint = 1) {
  if (!playerEl) return;
  const stage = playerEl.querySelector(".pdf-canvas-stage");
  if (!stage) return;

  let canvas = stage.querySelector("canvas");
  if (!canvas) {
    stage.innerHTML = "";
    canvas = document.createElement("canvas");
    stage.appendChild(canvas);
  }

  const token = String(++pdfRuntime.renderSeq);
  stage.dataset.renderToken = token;
  stage.classList.add("is-rendering");

  try {
    const doc = await getPdfDocument(srcBase);
    if (stage.dataset.renderToken !== token) return;

    const total = Math.max(1, Number(doc.numPages || maxHint || 1));
    const safePage = Math.min(total, Math.max(1, Number(page || 1)));
    const pageTag = playerEl.querySelector(".ppt-pdf-page");
    if (pageTag) pageTag.textContent = `Page ${safePage}/${total}`;

    const pdfPage = await doc.getPage(safePage);
    if (stage.dataset.renderToken !== token) return;

    const rect = stage.getBoundingClientRect();
    const stageW = Math.max(320, Math.floor(rect.width || stage.clientWidth || playerEl.clientWidth || 960));
    const stageH = Math.max(260, Math.floor(rect.height || stage.clientHeight || 560));
    const rawViewport = pdfPage.getViewport({ scale: 1 });
    const scale = Math.max(0.1, Math.min(stageW / rawViewport.width, stageH / rawViewport.height));
    const viewport = pdfPage.getViewport({ scale });

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
    canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewport.width, viewport.height);
    const task = pdfPage.render({ canvasContext: ctx, viewport });
    await task.promise;
    if (stage.dataset.renderToken !== token) return;
  } catch (err) {
    if (stage.dataset.renderToken !== token) return;
    stage.innerHTML = `<div class="studio-preview-empty">Failed to render this PDF page: ${escapeHtml(String(err?.message || err || "Unknown error"))}</div>`;
  } finally {
    if (stage.dataset.renderToken === token) {
      stage.classList.remove("is-rendering");
    }
  }
}

function ensureAiChatState(mode, moduleId) {
  const bag = aiChatBag(mode);
  bag[moduleId] ||= { draft: "", history: [], sending: false, error: "" };
  return bag[moduleId];
}

function renderAiAssistantPlayer(container, module, mode) {
  const cfg = getAiConfig(module);
  const chat = ensureAiChatState(mode, module.id);
  const canAsk = Boolean(cfg.systemPrompt || cfg.knowledge);
  const showContextMeta = mode !== "teaching";
  const historyHtml = (chat.history || []).map((item) => `
    <article class="quiz-question">
      <div class="quiz-question-title">Question</div>
      <div class="quiz-question-body">${escapeHtml(item.question || "")}</div>
      <div class="quiz-question-title" style="margin-top:8px;">Answer</div>
      <div class="quiz-question-body">${escapeHtml(item.answer || "")}</div>
    </article>
  `).join("");
  container.innerHTML = `
    <div class="quiz-player">
      <div class="quiz-player-head">
        <div class="ai-bot-head ${chat.sending ? "is-speaking" : ""}">
          <div class="ai-bot-avatar" aria-hidden="true">
            <span class="ai-bot-eye left"></span>
            <span class="ai-bot-eye right"></span>
            <span class="ai-bot-mouth"></span>
            <span class="ai-bot-antenna"></span>
          </div>
          <div>
            <h3>${escapeHtml(module.moduleName)} · AI Assistant</h3>
            ${showContextMeta ? `<p>Model: ${escapeHtml(cfg.model)}</p>` : ""}
          </div>
        </div>
      </div>
      <div class="quiz-form">
        ${showContextMeta ? `
        <article class="quiz-question">
          <div class="quiz-question-title">System Prompt</div>
          <div class="quiz-question-body">${cfg.systemPrompt ? escapeHtml(cfg.systemPrompt) : "<span class=\"muted-text\">Not configured</span>"}</div>
          <div class="quiz-question-title" style="margin-top:8px;">Knowledge Summary</div>
          <div class="quiz-question-body">${cfg.knowledge ? escapeHtml(cfg.knowledge.slice(0, 1200)) : "<span class=\"muted-text\">Not configured</span>"}</div>
        </article>` : ""}
        ${historyHtml || '<div class="muted-text">No questions yet</div>'}
      </div>
      <div class="quiz-actions" style="margin-top:12px; align-items:flex-start;">
        <textarea class="quiz-textarea" rows="3" style="flex:1; min-width:280px;" data-ai-input="${mode}" data-mid="${module.id}" placeholder="Enter a classroom question, e.g. explain molecular thermal motion using everyday examples.">${escapeHtml(chat.draft || "")}</textarea>
        <button class="primary-btn" type="button" data-step="${mode}-ai-send" data-mid="${module.id}" ${canAsk ? "" : "disabled"}>${chat.sending ? "Answering..." : "Send Question"}</button>
      </div>
      <div class="quiz-status">${canAsk ? "" : "Configure a system prompt or knowledge base for this module first."}${chat.error ? ` | ${escapeHtml(chat.error)}` : ""}</div>
    </div>
  `;
}

async function sendAiQuestion(mode, moduleId) {
  const snapshot = mode === "preview" ? state.preview.snapshot : state.teaching.snapshot;
  const module = snapshot?.modules?.find((x) => x.id === Number(moduleId));
  if (!module) return;
  const cfg = getAiConfig(module);
  const chat = ensureAiChatState(mode, module.id);
  const question = String(chat.draft || "").trim();
  if (!question) {
    chat.error = "Please enter a question first";
    return mode === "preview" ? renderPreview() : renderTeaching();
  }
  if (!cfg.systemPrompt && !cfg.knowledge) {
    chat.error = "Configure a system prompt or knowledge base first";
    return mode === "preview" ? renderPreview() : renderTeaching();
  }
  chat.error = "";
  chat.sending = true;
  mode === "preview" ? renderPreview() : renderTeaching();
  try {
    const res = await fetch(apiUrl("/api/ai/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        provider: "deepseek",
        model: cfg.model,
        systemPrompt: cfg.systemPrompt,
        knowledge: cfg.knowledge,
        question,
      }),
    });
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) throw new Error(String(data?.error || "AI request failed"));
    const answer = String(data?.answer || "").trim();
    if (!answer) throw new Error("AI did not return a valid answer");
    chat.history.push({ question, answer, at: now() });
    if (chat.history.length > 8) chat.history = chat.history.slice(chat.history.length - 8);
    chat.draft = "";
  } catch (err) {
    chat.error = String(err?.message || err || "AI request failed");
  } finally {
    chat.sending = false;
    mode === "preview" ? renderPreview() : renderTeaching();
  }
}
function renderStepContent(container, snapshot, m, mode, nxt, info) {
  const pages = mode === "preview" ? state.preview.pages : state.teaching.pages;
  const hasNext = Boolean(nxt.length);
  if (m.contentType === "ppt") {
    const srcBase = String(m.compile?.data?.src || "");
    const max = getKnownPdfPageCount(srcBase, Number(m.compile?.data?.pages || 1));
    const page = Math.min(max, Math.max(1, Number(pages[m.id] || 1)));
    pages[m.id] = page;
    const playerClass = mode === "teaching" ? "ppt-pdf-player ppt-pdf-player-teaching" : "ppt-pdf-player";
    const existing = container.querySelector(".ppt-pdf-player");
    if (existing && Number(existing.dataset.moduleId) === Number(m.id) && existing.dataset.mode === mode && existing.dataset.srcBase === srcBase) {
      const pageTag = existing.querySelector(".ppt-pdf-page");
      if (pageTag) pageTag.textContent = `Page ${page}/${max}`;
      renderPdfPageCanvas(existing, srcBase, page, max);
    } else {
      container.innerHTML = `<div class="${playerClass}" data-module-id="${m.id}" data-mode="${mode}" data-src-base="${escapeHtml(srcBase)}"><div class="ppt-pdf-toolbar"><button class="ghost-btn" type="button" data-step="${mode}-ppt-prev">Previous Page</button><span class="ppt-pdf-page">Page ${page}/${max}</span><button class="ghost-btn" type="button" data-step="${mode}-ppt-next">Next Page</button></div><div class="pdf-canvas-stage is-rendering"><canvas></canvas></div></div>`;
      const player = container.querySelector(".ppt-pdf-player");
      renderPdfPageCanvas(player, srcBase, page, max);
    }
    return { info: `${info} · Page ${page}/${max}`, decision: false, hasNext };
  }
  if (m.contentType === "video") {
    container.innerHTML = `<video class="module-video-player" controls preload="metadata" src="${escapeHtml(m.compile?.data?.src || "")}"></video>`;
    return { info, decision: false, hasNext };
  }
  if (m.contentType === "interactive") {
    container.innerHTML = `<iframe src="${escapeHtml(m.compile?.data?.src || "")}" title="Interactive Activity"></iframe>`;
    return { info, decision: false, hasNext };
  }
  if (m.contentType === "quiz") {
    const a = mode === "preview" ? state.preview.answers : state.teaching.answers;
    const r = mode === "preview" ? state.preview.results : state.teaching.results;
    renderQuiz(container, m, a, r, mode);
    return { info, decision: false, hasNext };
  }
  if (m.contentType === "ai_assistant") {
    renderAiAssistantPlayer(container, m, mode);
    return { info: `${info} · AI Chat`, decision: false, hasNext };
  }
  if (m.contentType === "decision") {
    const opts = nxt.map((id) => snapshot.modules.find((x) => x.id === id)).filter(Boolean).map((x) => `<button class="primary-btn" type="button" data-step="${mode}-branch" data-target="${x.id}">${escapeHtml(x.moduleName)}</button>`).join("");
    container.innerHTML = `<section class="studio-branch-picker"><div class="studio-branch-title">Choose the next branch</div><div class="studio-branch-list">${opts || '<div class="muted-text">No branches configured</div>'}</div></section>`;
    return { info: `${info} · Branch Selection`, decision: true, hasNext };
  }
  container.innerHTML = `<div class="studio-preview-empty">${m.contentType === "merge" ? "Merge module: continue to the shared next step" : "This type is not supported yet"}</div>`;
  return { info, decision: false, hasNext };
}

function renderStep(container, snapshot, moduleId, mode) {
  const m = snapshot.modules.find((x) => x.id === Number(moduleId));
  if (!m) { container.innerHTML = '<div class="studio-preview-empty">Module not found</div>'; return { info: "", decision: false, hasNext: false }; }
  const nxt = nextPlayableIds(snapshot, m.id);
  const info = `${m.moduleName} · ${contentLabel(m.contentType)}`;
  const ai = m.contentType === "ai_assistant" ? null : attachedAiModule(snapshot, m.id);
  if (!ai) return renderStepContent(container, snapshot, m, mode, nxt, info);

  container.innerHTML = `<div class="studio-step-layout"><div class="studio-step-main"></div><aside class="studio-ai-dock"></aside></div>`;
  const main = container.querySelector(".studio-step-main");
  const dock = container.querySelector(".studio-ai-dock");
  const result = renderStepContent(main, snapshot, m, mode, nxt, info);
  renderAiAssistantPlayer(dock, ai, mode);
  return { ...result, info: `${result.info} · AI Chat` };
}

function movePreview(targetId = null) {
  const s = state.preview.snapshot; if (!s) return;
  const cur = s.sequence[state.preview.index];
  const nxt = nextPlayableIds(s, cur); if (!nxt.length) return;
  const id = Number(targetId || nxt[0]);
  const idx = s.sequence.indexOf(id); if (idx < 0) return;
  state.preview.index = idx; renderPreview();
}

function renderPreview() {
  if (state.preview.timer) { clearTimeout(state.preview.timer); state.preview.timer = null; }
  const s = state.preview.snapshot; if (!s) return;
  const id = s.sequence[state.preview.index];
  const r = renderStep(dom.previewBody, s, id, "preview");
  const playable = playableModuleIds(s);
  const playableIndex = Math.max(0, playable.indexOf(Number(id)));
  dom.previewStepInfo.textContent = `${r.info} · ${playableIndex + 1}/${Math.max(1, playable.length)}`;
  dom.previewPrevBtn.disabled = playableIndex <= 0;
  dom.previewNextBtn.disabled = r.decision || !r.hasNext;
  if (dom.previewAutoPlayToggle.checked && !r.decision && r.hasNext) {
    state.preview.timer = setTimeout(() => movePreview(), clampSec(dom.previewAutoPlaySeconds.value, 12) * 1000);
  }
}

function openPreview(startId = null) {
  const p = curProject();
  if (!p?.modules?.length) return alert("The current project has no modules");
  state.preview.snapshot = snapshotOf(p, { publishId: 0, name: p.name, description: p.description, publishedAt: now(), autoPlay: false, autoPlaySeconds: 12 });
  state.preview.answers = {}; state.preview.results = {}; state.preview.pages = {}; state.preview.aiChats = {};
  let id = Number(startId || firstId(state.preview.snapshot));
  const startModule = state.preview.snapshot.modules.find((x) => x.id === id);
  if (startModule?.contentType === "ai_assistant") {
    id = ownerModuleForAi(state.preview.snapshot, startModule.id)?.id || firstId(state.preview.snapshot);
  }
  const i = state.preview.snapshot.sequence.indexOf(id);
  state.preview.index = i >= 0 ? i : 0;
  dom.previewProjectTitle.textContent = `${p.name} (Preview)`;
  dom.previewAutoPlayToggle.checked = false;
  dom.previewAutoPlaySeconds.value = "12";
  dom.previewModal.classList.remove("hidden");
  renderPreview();
}

function renderTeachingList() {
  const list = [...state.published.values()].sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt));
  dom.teachingProjectList.innerHTML = list.map((s) => `<article class="teaching-demo-item"><div><strong>${escapeHtml(s.name)}</strong></div><div class="muted-text">${escapeHtml(s.description || "(No description)")}</div><div class="muted-text">${new Date(s.publishedAt).toLocaleString()}</div><button class="primary-btn" type="button" data-open-teach="${s.projectId}">Start Playback</button></article>`).join("") || '<div class="muted-text">No published projects yet</div>';
}

function renderTeaching() {
  const s = state.teaching.snapshot;
  if (!s || !state.teaching.currentId) {
    document.body.classList.remove("teaching-pdf-focus");
    document.body.classList.remove("teaching-playback-mode");
    dom.teachingPlayerTitle.textContent = "Classroom Player";
    dom.teachingPlayerStep.textContent = "";
    dom.teachingPlayerArea.innerHTML = '<div class="teaching-demo-empty">Publish a project in the course editor first, then play it here.</div>';
    dom.teachingPrevBtn.disabled = true; dom.teachingNextBtn.disabled = true; return;
  }
  document.body.classList.add("teaching-playback-mode");
  const m = s.modules.find((x)=>x.id===state.teaching.currentId);
  const pdfFocus = Boolean(m && m.contentType === "ppt");
  document.body.classList.toggle("teaching-pdf-focus", pdfFocus);
  if (pdfFocus && !isFullscreenActive()) enterTeachingFullscreen();
  dom.teachingPlayerTitle.textContent = m ? `${s.name} · ${m.moduleName}` : s.name;
  const r = renderStep(dom.teachingPlayerArea, s, state.teaching.currentId, "teaching");
  dom.teachingPlayerStep.textContent = `${r.info} · Step ${state.teaching.history.length}`;
  dom.teachingPrevBtn.disabled = state.teaching.history.length <= 1;
  dom.teachingNextBtn.disabled = r.decision || !r.hasNext;
}

function changePptPage(mode, delta) {
  const isPreview = mode === "preview";
  const snapshot = isPreview ? state.preview.snapshot : state.teaching.snapshot;
  if (!snapshot) return false;
  const currentId = isPreview ? snapshot.sequence[state.preview.index] : state.teaching.currentId;
  const module = snapshot.modules.find((x) => x.id === Number(currentId));
  if (!module || module.contentType !== "ppt") return false;
  const pagesBag = isPreview ? state.preview.pages : state.teaching.pages;
  const srcBase = String(module.compile?.data?.src || "");
  const max = getKnownPdfPageCount(srcBase, Number(module.compile?.data?.pages || 1));
  const current = Math.min(max, Math.max(1, Number(pagesBag[module.id] || 1)));
  const next = Math.min(max, Math.max(1, current + Number(delta || 0)));
  if (next === current) return false;
  pagesBag[module.id] = next;
  if (isPreview) renderPreview();
  else renderTeaching();
  return true;
}

function moveTeaching(targetId = null) {
  const s = state.teaching.snapshot; if (!s || !state.teaching.currentId) return;
  const nxt = nextPlayableIds(s, state.teaching.currentId); if (!nxt.length) return;
  const id = Number(targetId || nxt[0]);
  state.teaching.currentId = id; state.teaching.history.push(id); renderTeaching();
}

function switchView(view) {
  const studio = view === "studio";
  dom.app.style.display = studio ? "" : "none";
  dom.teachingSection.classList.toggle("active", !studio);
  dom.switchStudioBtn.className = studio ? "primary-btn" : "ghost-btn";
  dom.switchTeachingBtn.className = studio ? "ghost-btn" : "primary-btn";
  if (studio) {
    document.body.classList.remove("teaching-fullscreen-mode");
    document.body.classList.remove("teaching-pdf-focus");
    document.body.classList.remove("teaching-playback-mode");
  }
  if (!studio) renderTeachingList();
}

async function init() {
  const canInit = await ensureServedMode();
  if (!canInit) return;
  clearLegacyLocalStateKeys();

  dom.userCard.innerHTML = '<img alt="avatar" src="data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2288%22 height=%2288%22%3E%3Crect width=%2288%22 height=%2288%22 rx=%2244%22 fill=%22%230e1e3f%22/%3E%3Ccircle cx=%2244%22 cy=%2232%22 r=%2215%22 fill=%22%237db8ff%22/%3E%3Cpath d=%22M15 71c6-13 16-21 29-21s23 8 29 21%22 fill=%22%237db8ff%22/%3E%3C/svg%3E"/><div><div class="studio-user-name">物理教师</div><div class="studio-user-role">Physics Teaching Group</div></div>';
  dom.moduleContentSelect.innerHTML = CONTENT_OPTIONS.map((o) => `<option value="${o.key}">${o.label}</option>`).join("");
  dom.moduleColorSelect.innerHTML = COLOR_OPTIONS.map((c) => `<option value="${c}">${c}</option>`).join("");
  dom.moduleShapeSelect.innerHTML = SHAPE_OPTIONS.map((s) => `<option value="${s}">${s}</option>`).join("");
  dom.aiModelSelect.innerHTML = AI_MODEL_OPTIONS.map((o) => `<option value="${o.value}">${o.label}</option>`).join("");
  dom.aiModelSelect.value = AI_MODEL_OPTIONS[0].value;
  updateAiModelHint();

  const forceBootstrap = shouldForceBootstrap();
  if (forceBootstrap) clearWorkspaceLocalState();
  const localLoaded = forceBootstrap ? false : loadLocalState();
  const bootLoaded = localLoaded ? true : await loadBootstrapData();
  if (!bootLoaded) makeProject();
  rerenderStudio();
  renderTeachingList();

  dom.switchStudioBtn.addEventListener("click", () => switchView("studio"));
  dom.switchTeachingBtn.addEventListener("click", () => switchView("teaching"));
  dom.createProjectBtn.addEventListener("click", () => { makeProject(); rerenderStudio(); });

  dom.projectList.addEventListener("click", (e) => {
    const c = e.target.closest("[data-project-id]");
    if (!c) return;
    state.currentProjectId = Number(c.dataset.projectId);
    rerenderStudio();
  });

  dom.projectList.addEventListener("contextmenu", (e) => {
    const c = e.target.closest("[data-project-id]");
    if (!c) return;
    e.preventDefault();
    closeConnectionMenu(true);
    state.contextProjectId = Number(c.dataset.projectId);
    dom.projectContextMenu.style.left = `${e.clientX}px`;
    dom.projectContextMenu.style.top = `${e.clientY}px`;
    dom.projectContextMenu.classList.remove("hidden");
  });

  dom.projectDuplicateAction.addEventListener("click", () => {
    const p = state.projects.find((x) => x.id === state.contextProjectId);
    dom.projectContextMenu.classList.add("hidden");
    if (!p) return;
    state.seq.project += 1;
    const n = JSON.parse(JSON.stringify(p));
    n.id = state.seq.project;
    n.name = `${p.name} - Copy`;
    n.updatedAt = now();
    state.projects.unshift(n);
    state.currentProjectId = n.id;
    rerenderStudio();
  });

  dom.projectDeleteAction.addEventListener("click", () => {
    const id = Number(state.contextProjectId);
    dom.projectContextMenu.classList.add("hidden");
    if (!Number.isInteger(id)) return;
    if (!window.confirm("Delete this project?")) return;
    const p = state.projects.find((x) => x.id === id);
    p?.modules?.forEach((m) => revokeBlobUrl(m.file?.src));
    state.projects = state.projects.filter((x) => x.id !== id);
    state.published.delete(id);
    if (!state.projects.length) makeProject();
    state.currentProjectId = state.projects[0].id;
    rerenderStudio();
    renderTeachingList();
  });

  dom.connectionDeleteAction?.addEventListener("click", () => {
    const p = curProject();
    const target = state.contextConnection;
    closeConnectionMenu();
    if (!p || !target) return;
    const idx = p.connections.findIndex((c) =>
      Number(c.fromModuleId) === Number(target.fromModuleId)
      && Number(c.toModuleId) === Number(target.toModuleId));
    if (idx < 0) return;
    p.connections.splice(idx, 1);
    p.updatedAt = now();
    rerenderStudio();
  });

  dom.projectNameDisplay.addEventListener("click", () => {
    const p = curProject();
    if (!p) return;
    dom.projectNameInput.value = p.name;
    dom.projectNameDisplay.classList.add("hidden");
    dom.projectNameInput.classList.remove("hidden");
    dom.projectNameInput.focus();
    dom.projectNameInput.select();
  });

  const commitName = () => {
    const p = curProject();
    if (!p) return;
    const v = String(dom.projectNameInput.value || "").trim();
    if (v) p.name = v;
    p.updatedAt = now();
    dom.projectNameDisplay.classList.remove("hidden");
    dom.projectNameInput.classList.add("hidden");
    rerenderStudio();
  };

  dom.projectNameInput.addEventListener("blur", commitName);
  dom.projectNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitName();
    }
  });

  dom.createModuleBtn.addEventListener("click", () => {
    showMsg(dom.moduleFormMessage, "");
    dom.moduleModal.classList.remove("hidden");
    dom.moduleNameInput.value = "";
    dom.moduleContentSelect.value = CONTENT_OPTIONS[0].key;
    dom.moduleColorSelect.value = COLOR_OPTIONS[0];
    dom.moduleShapeSelect.value = SHAPE_OPTIONS[0];
  });

  dom.moduleModalCancelBtn.addEventListener("click", () => dom.moduleModal.classList.add("hidden"));
  dom.moduleModal.addEventListener("click", (e) => { if (e.target === dom.moduleModal) dom.moduleModal.classList.add("hidden"); });

  dom.moduleForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const p = curProject();
    if (!p) return;
    state.seq.module += 1;
    const idx = p.modules.length;
    const type = dom.moduleContentSelect.value;
    const auto = p.modules.filter((m) => m.contentType === type).length + 1;
    const moduleName = String(dom.moduleNameInput.value || "").trim() || `${contentLabel(type)}${auto}`;
    p.modules.push({
      id: state.seq.module,
      moduleName,
      contentType: type,
      color: dom.moduleColorSelect.value,
      shape: dom.moduleShapeSelect.value,
      positionX: GRID_OFFSET + (idx % 5) * 300,
      positionY: GRID_OFFSET + Math.floor(idx / 5) * 220,
      file: null,
      compile: type === "ai_assistant"
        ? { ready: false, summary: "AI Assistant not configured", data: { type: "ai_assistant", aiConfig: emptyAiConfig() } }
        : { ready: !needFile(type), summary: needFile(type) ? "No file uploaded" : "Logic module ready to connect", data: null },
    });
    p.updatedAt = now();
    dom.moduleModal.classList.add("hidden");
    rerenderStudio();
  });

  dom.saveProjectBtn.addEventListener("click", async () => {
    const p = curProject();
    if (!p) return;
    let ok = 0;
    let fail = 0;
    for (const m of p.modules) {
      if (needFile(m.contentType) && m.compile?.ready && !m.file?.raw) {
        ok += 1;
        continue;
      }
      try { await compileModule(p, m); ok += 1; } catch { fail += 1; }
    }
    rerenderStudio();
    alert(`Compile complete: ${ok} succeeded, ${fail} failed`);
  });

  dom.undoBtn.addEventListener("click", () => alert("Undo is not supported in this version"));
  dom.redoBtn.addEventListener("click", () => alert("Redo is not supported in this version"));

  dom.publishBtn.addEventListener("click", () => {
    const p = curProject();
    if (!p) return;
    dom.publishNameInput.value = p.name;
    dom.publishDescriptionInput.value = p.description || "";
    showMsg(dom.publishFormMessage, "");
    dom.publishModal.classList.remove("hidden");
  });

  dom.publishCancelBtn.addEventListener("click", () => dom.publishModal.classList.add("hidden"));
  dom.publishModal.addEventListener("click", (e) => { if (e.target === dom.publishModal) dom.publishModal.classList.add("hidden"); });

  dom.publishForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const p = curProject();
    if (!p) return;
    const miss = p.modules.filter((m) => (needFile(m.contentType) || m.contentType === "ai_assistant") && !m.compile?.ready);
    if (miss.length) {
      showMsg(dom.publishFormMessage, `Uncompiled modules: ${miss.map((m) => m.moduleName).join(", ")}`);
      return;
    }
    state.seq.publish += 1;
    p.name = String(dom.publishNameInput.value || "").trim() || p.name;
    p.description = String(dom.publishDescriptionInput.value || "").trim();
    p.updatedAt = now();
    const snap = snapshotOf(p, {
      publishId: state.seq.publish,
      name: p.name,
      description: p.description,
      publishedAt: now(),
      autoPlay: Boolean(dom.publishAutoPlay.checked),
      autoPlaySeconds: clampSec(dom.publishAutoPlaySeconds.value, 12),
    });
    state.published.set(p.id, snap);
    showMsg(dom.publishFormMessage, "Published successfully. You can view it in the classroom player.", false);
    rerenderStudio();
    renderTeachingList();
    setTimeout(() => dom.publishModal.classList.add("hidden"), 250);
  });

  dom.previewBtn.addEventListener("click", () => openPreview());
  dom.previewCloseBtn.addEventListener("click", () => {
    if (state.preview.timer) { clearTimeout(state.preview.timer); state.preview.timer = null; }
    dom.previewModal.classList.add("hidden");
  });
  dom.previewModal.addEventListener("click", (e) => {
    if (e.target === dom.previewModal) {
      if (state.preview.timer) { clearTimeout(state.preview.timer); state.preview.timer = null; }
      dom.previewModal.classList.add("hidden");
    }
  });
  dom.previewPrevBtn.addEventListener("click", () => {
    const s = state.preview.snapshot;
    if (!s) return;
    const playable = playableModuleIds(s);
    const cur = s.sequence[state.preview.index];
    const i = playable.indexOf(Number(cur));
    if (i <= 0) return;
    const prevIndex = s.sequence.indexOf(playable[i - 1]);
    if (prevIndex >= 0) {
      state.preview.index = prevIndex;
      renderPreview();
    }
  });
  dom.previewNextBtn.addEventListener("click", () => movePreview());
  dom.previewAutoPlayToggle.addEventListener("change", renderPreview);
  dom.previewAutoPlaySeconds.addEventListener("change", () => { dom.previewAutoPlaySeconds.value = String(clampSec(dom.previewAutoPlaySeconds.value, 12)); renderPreview(); });

  dom.moduleUploadAction.addEventListener("click", () => {
    const p = curProject();
    const m = moduleById(p, state.contextModuleId);
    if (!m) return;
    if (m.contentType === "ai_assistant") {
      closeModuleMenu();
      openAiAssistantModal(m);
      return;
    }
    if (!needFile(m.contentType)) {
      closeModuleMenu();
      alert("This module type does not require a file upload");
      return;
    }
    state.uploadModuleId = m.id;
    dom.moduleUploadInput.accept = m.contentType === "quiz" ? ".json,.csv,.tsv,.txt,.zip,.xlsx" : m.contentType === "interactive" ? ".html,.htm" : m.contentType === "video" ? ".mp4,.webm,.ogg,.ogv,.mov,.m4v,video/*" : m.contentType === "ppt" ? ".pdf,.ppt,.pptx,.pps,.ppsx,.pot,.potx" : "";
    dom.moduleUploadInput.value = "";
    closeModuleMenu();
    dom.moduleUploadInput.click();
  });

  dom.moduleUploadInput.addEventListener("change", async () => {
    const p = curProject();
    const m = moduleById(p, state.uploadModuleId);
    const f = dom.moduleUploadInput.files?.[0];
    state.uploadModuleId = null;
    if (!m || !f) return;
    try {
      await compileModule(p, m, f);
      rerenderStudio();
      alert(`Module "${m.moduleName}" uploaded and compiled successfully`);
    } catch (err) {
      m.compile = { ready: false, summary: `Compile failed: ${err.message}`, data: null };
      rerenderStudio();
      alert(err.message);
    }
  });

  dom.moduleRenameAction.addEventListener("click", () => {
    const p = curProject();
    const m = moduleById(p, state.contextModuleId);
    closeModuleMenu();
    if (!m) return;
    const v = String(window.prompt("Enter a new module name", m.moduleName) || "").trim();
    if (!v) return;
    m.moduleName = v;
    p.updatedAt = now();
    rerenderStudio();
  });

  dom.moduleAIAssistantAction.addEventListener("click", () => {
    const p = curProject();
    const m = moduleById(p, state.contextModuleId);
    closeModuleMenu();
    if (!m) return;
    if (m.contentType !== "ai_assistant") {
      alert("Create an AI Assistant module first, then configure it.");
      return;
    }
    openAiAssistantModal(m);
  });

  dom.aiModelSelect.addEventListener("change", updateAiModelHint);
  dom.aiAssistantCancelBtn.addEventListener("click", closeAiAssistantModal);
  dom.aiAssistantModal.addEventListener("click", (e) => {
    if (e.target === dom.aiAssistantModal) closeAiAssistantModal();
  });
  dom.aiKnowledgeUploadBtn.addEventListener("click", () => {
    dom.aiKnowledgeUploadInput.value = "";
    dom.aiKnowledgeUploadInput.click();
  });
  dom.aiKnowledgeUploadInput.addEventListener("change", async () => {
    try {
      await appendKnowledgeByFiles(dom.aiKnowledgeUploadInput.files);
      showMsg(dom.aiAssistantMessage, "Knowledge base content appended", false);
    } catch (err) {
      showMsg(dom.aiAssistantMessage, `Failed to read knowledge base: ${err.message || err}`);
    }
  });
  dom.aiTestBtn.addEventListener("click", async () => {
    const question = String(dom.aiTestQuestionInput.value || "").trim();
    if (!question) {
      showMsg(dom.aiAssistantMessage, "Please enter a test question");
      return;
    }
    dom.aiTestResponse.textContent = "Requesting AI...";
    showMsg(dom.aiAssistantMessage, "");
    try {
      const res = await fetch(apiUrl("/api/ai/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          provider: "deepseek",
          model: dom.aiModelSelect.value,
          systemPrompt: String(dom.aiSystemPromptInput.value || ""),
          knowledge: String(dom.aiKnowledgeInput.value || ""),
          question,
        }),
      });
      let data = {};
      try { data = await res.json(); } catch {}
      if (!res.ok) throw new Error(String(data?.error || "Test request failed"));
      dom.aiTestResponse.textContent = String(data?.answer || "");
      showMsg(dom.aiAssistantMessage, "Test succeeded", false);
    } catch (err) {
      dom.aiTestResponse.textContent = "";
      showMsg(dom.aiAssistantMessage, String(err?.message || err));
    }
  });
  dom.aiAssistantForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const p = curProject();
    const m = moduleById(p, state.aiModalModuleId);
    if (!p || !m) return;
    applyAiConfigToModule(m, {
      model: dom.aiModelSelect.value,
      systemPrompt: dom.aiSystemPromptInput.value,
      knowledge: dom.aiKnowledgeInput.value,
    });
    p.updatedAt = now();
    closeAiAssistantModal();
    rerenderStudio();
  });

  dom.moduleDeleteAction.addEventListener("click", () => {
    const p = curProject();
    const m = moduleById(p, state.contextModuleId);
    closeModuleMenu();
    if (!m) return;
    if (!window.confirm(`Delete module "${m.moduleName}"?`)) return;
    revokeBlobUrl(m.file?.src);
    p.modules = p.modules.filter((x) => x.id !== m.id);
    p.connections = p.connections.filter((c) => c.fromModuleId !== m.id && c.toModuleId !== m.id);
    p.updatedAt = now();
    rerenderStudio();
  });

  dom.moduleColorPanel.addEventListener("click", (e) => {
    const b = e.target.closest("[data-color]");
    if (!b) return;
    const p = curProject();
    const m = moduleById(p, state.contextModuleId);
    if (!m) return;
    m.color = b.dataset.color;
    p.updatedAt = now();
    rerenderStudio();
  });

  dom.moduleShapePanel.addEventListener("click", (e) => {
    const b = e.target.closest("[data-shape]");
    if (!b) return;
    const p = curProject();
    const m = moduleById(p, state.contextModuleId);
    if (!m) return;
    m.shape = b.dataset.shape;
    p.updatedAt = now();
    rerenderStudio();
  });

  dom.teachingPrevBtn.addEventListener("click", () => {
    if (state.teaching.history.length <= 1) return;
    state.teaching.history.pop();
    state.teaching.currentId = state.teaching.history[state.teaching.history.length - 1];
    renderTeaching();
  });
  dom.teachingNextBtn.addEventListener("click", () => moveTeaching());

  const syncTeachingFullscreenClass = () => {
    if (!isFullscreenActive()) document.body.classList.remove("teaching-fullscreen-mode");
  };
  document.addEventListener("fullscreenchange", syncTeachingFullscreenClass);
  document.addEventListener("webkitfullscreenchange", syncTeachingFullscreenClass);

  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!t.closest("#moduleContextMenu")) closeModuleMenu();
    if (!t.closest("#connectionContextMenu")) closeConnectionMenu(true);
    if (!t.closest("#projectContextMenu")) dom.projectContextMenu.classList.add("hidden");

    const step = t?.dataset?.step;
    if (step === "preview-ppt-prev") return changePptPage("preview", -1);
    if (step === "preview-ppt-next") return changePptPage("preview", 1);
    if (step === "preview-branch") return movePreview(Number(t.dataset.target));
    if (step === "teaching-ppt-prev") return changePptPage("teaching", -1);
    if (step === "teaching-ppt-next") return changePptPage("teaching", 1);
    if (step === "teaching-branch") return moveTeaching(Number(t.dataset.target));
    if (step === "preview-ai-send") return sendAiQuestion("preview", Number(t.dataset.mid));
    if (step === "teaching-ai-send") return sendAiQuestion("teaching", Number(t.dataset.mid));

    const open = t.closest("[data-open-teach]");
    if (open) {
      const s = state.published.get(Number(open.dataset.openTeach));
      if (!s) return;
      state.teaching.snapshot = s;
      state.teaching.currentId = firstId(s);
      state.teaching.history = [state.teaching.currentId].filter(Boolean);
      state.teaching.answers = {};
      state.teaching.results = {};
      state.teaching.pages = {};
      state.teaching.aiChats = {};
      document.body.classList.add("teaching-playback-mode");
      renderTeaching();
      enterTeachingFullscreen();
      return;
    }

    const qsubmit = t?.dataset?.qsubmit;
    if (qsubmit) {
      const mid = Number(t.dataset.mid);
      if (qsubmit === "preview") {
        const m = state.preview.snapshot?.modules.find((x) => x.id === mid);
        if (!m) return;
        state.preview.results[mid] = scoreQuiz(m, state.preview.answers[mid] || {});
        renderPreview();
      } else {
        const m = state.teaching.snapshot?.modules.find((x) => x.id === mid);
        if (!m) return;
        state.teaching.results[mid] = scoreQuiz(m, state.teaching.answers[mid] || {});
        renderTeaching();
      }
    }
  });

  dom.previewBody.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-step="preview-ppt-prev"], [data-step="preview-ppt-next"]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if (btn.dataset.step === "preview-ppt-prev") changePptPage("preview", -1);
    else changePptPage("preview", 1);
  });

  dom.teachingPlayerArea.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-step="teaching-ppt-prev"], [data-step="teaching-ppt-next"]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if (btn.dataset.step === "teaching-ppt-prev") changePptPage("teaching", -1);
    else changePptPage("teaching", 1);
  });

  document.addEventListener("change", (e) => {
    const t = e.target;
    const qt = t.dataset.qt;
    if (!qt) return;
    const mid = Number(t.dataset.mid);
    const qid = String(t.dataset.qid || "");
    const bag = t.closest("#teachingDemoSection") ? state.teaching.answers : state.preview.answers;
    bag[mid] ||= {};
    if (qt === "single") bag[mid][qid] = String(t.value || "");
    else if (qt === "multiple") {
      const s = new Set(Array.isArray(bag[mid][qid]) ? bag[mid][qid] : []);
      if (t.checked) s.add(t.value); else s.delete(t.value);
      bag[mid][qid] = [...s];
    } else if (qt === "scale") bag[mid][qid] = Number(t.value);
  });

  document.addEventListener("input", (e) => {
    const t = e.target;
    const aiMode = t.dataset.aiInput;
    if (aiMode) {
      const mid = Number(t.dataset.mid);
      if (!Number.isInteger(mid)) return;
      const bag = aiChatBag(aiMode);
      bag[mid] ||= { draft: "", history: [], sending: false, error: "" };
      bag[mid].draft = String(t.value || "");
      return;
    }
    if (t.dataset.qt !== "text") return;
    const mid = Number(t.dataset.mid);
    const qid = String(t.dataset.qid || "");
    const bag = t.closest("#teachingDemoSection") ? state.teaching.answers : state.preview.answers;
    bag[mid] ||= {};
    bag[mid][qid] = t.value;
  });

  window.addEventListener("beforeunload", () => {
    persistLocalState();
    if (state.preview.timer) clearTimeout(state.preview.timer);
    state.projects.forEach((p) => p.modules.forEach((m) => revokeBlobUrl(m.file?.src)));
  });

  switchView("studio");
}

init();
