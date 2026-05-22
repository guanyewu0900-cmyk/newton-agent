const http = require("http");
const fs = require("fs");
const path = require("path");

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

loadDotEnv(path.join(__dirname, ".env"));

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 5173);
const ROOT = __dirname;
const UPLOAD_DIR = path.join(ROOT, "uploads");
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const SAMPLE_BOOTSTRAP = {
  currentProjectId: 1201,
  projects: [],
  published: [],
};

function createSimplePdfBuffer(lines) {
  const safeLines = (lines || []).map((line) => String(line || "").replace(/[()\\]/g, "\\$&"));
  const contentParts = ["BT", "/F1 22 Tf", "72 780 Td"];
  safeLines.forEach((line, idx) => {
    if (idx > 0) contentParts.push("0 -30 Td");
    contentParts.push(`(${line}) Tj`);
  });
  contentParts.push("ET");
  const stream = `${contentParts.join("\n")}\n`;

  const objects = {
    1: "<< /Type /Catalog /Pages 2 0 R >>",
    2: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    3: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    4: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    5: `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}endstream`,
  };

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 1; i <= 5; i += 1) {
    offsets[i] = Buffer.byteLength(pdf, "utf8");
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function ensureDemoAssets() {
  const demoPdf = path.join(UPLOAD_DIR, "demo_lesson_ppt.pdf");
  const demoInteractive = path.join(UPLOAD_DIR, "demo_interactive.html");
  const demoQuizImage = path.join(UPLOAD_DIR, "demo_quiz_image.svg");
  const newtonIntro = path.join(UPLOAD_DIR, "newton_intro.pdf");
  const newtonInteractive = path.join(UPLOAD_DIR, "newton_interactive.html");
  const newtonSummary = path.join(UPLOAD_DIR, "newton_summary.pdf");
  const newtonFaqXlsx = path.join(UPLOAD_DIR, "newton_faq.xlsx");
  const newtonFaqXls = path.join(UPLOAD_DIR, "newton_faq.xls");

  if (!fs.existsSync(demoPdf)) {
    const pdfBuffer = createSimplePdfBuffer([
      "Newton First Law - Demo",
      "Fallback slide for teaching preview",
      "Please import your course PDF resources."
    ]);
    fs.writeFileSync(demoPdf, pdfBuffer);
  }
  if (!fs.existsSync(demoInteractive)) {
    const html = "<!doctype html><html><head><meta charset=\"UTF-8\"><title>interactive</title></head><body><h3>Interactive Demo</h3></body></html>";
    fs.writeFileSync(demoInteractive, html, "utf8");
  }
  if (!fs.existsSync(demoQuizImage)) {
    const svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"320\" height=\"180\"><rect width=\"100%\" height=\"100%\" fill=\"#f2f8ff\"/></svg>";
    fs.writeFileSync(demoQuizImage, svg, "utf8");
  }

  const sourceAssets = [
    { src: path.join("D:\\documents", "\u4e0b\u8f7d", "\u725b\u987f\u7b2c\u4e00\u5b9a\u5f8b2026.1.8\u4e0a\u8bfe\u7248.pdf"), dst: newtonIntro },
    { src: path.join("D:\\documents", "\u4e0b\u8f7d", "newton_experiment_final_v4", "newton_experiment_final_v4.html"), dst: newtonInteractive },
    { src: path.join("D:\\documents", "\u4e0b\u8f7d", "\u725b\u987f\u7b2c\u4e00\u5b9a\u5f8b2026.1.8\u4e0a\u8bfe\u7248(1).pdf"), dst: newtonSummary },
    { src: path.join("C:\\Users\\Wushujing\\Desktop", "\u9644\u88682\u5b66\u751f\u95ee\u9898.xlsx"), dst: newtonFaqXlsx },
    { src: path.join("C:\\Users\\Wushujing\\Desktop", "\u9644\u88682\u5b66\u751f\u95ee\u9898.xls"), dst: newtonFaqXls }
  ];
  for (const item of sourceAssets) {
    try {
      if (!fs.existsSync(item.dst) && fs.existsSync(item.src)) {
        fs.copyFileSync(item.src, item.dst);
      }
    } catch {}
  }
}

function estimatePdfPages(filePath) {
  try {
    if (!fs.existsSync(filePath)) return 1;
    const buf = fs.readFileSync(filePath);
    const head = buf.slice(0, Math.min(buf.length, 2 * 1024 * 1024)).toString("utf8");
    const pages = (head.match(/\/Type\s*\/Page\b/g) || []).length;
    return Math.max(1, pages || 1);
  } catch {
    return 1;
  }
}

function extractTextFromLegacyXls(buffer) {
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
  const text = buffer
    .toString("utf16le")
    .replace(/\u0000/g, " ")
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9,.:;!?%()\[\]{}<>\-_=+\/\\\s]/g, " ");
  const lines = text
    .split(/\r?\n/)
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter((x) => x.length >= 4 && x.length <= 180)
    .filter((x) => /[\u4e00-\u9fa5a-zA-Z0-9]{6,}/.test(x))
    .filter((x) => ((x.match(/\s/g) || []).length / Math.max(1, x.length)) < 0.24)
    .filter((x) => !noiseWords.some((k) => x.toLowerCase().includes(k)))
    .filter((x) => {
      const cjkCount = (x.match(/[\u4e00-\u9fa5]/g) || []).length;
      const wordCount = (x.match(/[a-zA-Z]{3,}/g) || []).length;
      return cjkCount >= 2 || wordCount >= 2;
    });
  return [...new Set(lines)].slice(0, 240).join("\n");
}

function looksLikeMojibake(text) {
  const src = String(text || "");
  if (!src.trim()) return false;
  const compact = src.replace(/\s+/g, "");
  const total = Math.max(1, compact.length);
  const latinExtended = (compact.match(/[\u00C0-\u024F]/g) || []).length;
  const mojibakeMarks = (compact.match(/[ÃÂÐÑÞæçèéêëìíîïðñòóôõöøùúûüýþ]/g) || []).length;
  return latinExtended / total > 0.12 || mojibakeMarks >= 12;
}

function buildKnowledgeFromRows(rows) {
  const out = [];
  for (const row of rows || []) {
    const question = getRowValue(row, ["question", "prompt", "\u95ee\u9898", "\u5b66\u751f\u95ee\u9898"]).trim();
    const answer = getRowValue(row, ["answer", "\u56de\u590d", "\u56de\u7b54", "\u6559\u5e08\u56de\u7b54"]).trim();
    if (question || answer) out.push(`Q: ${question}\nA: ${answer}`);
  }
  return out.join("\n\n");
}

function buildNewtonFaqKnowledge() {
  const faqXlsx = path.join(UPLOAD_DIR, "newton_faq.xlsx");
  const faqXls = path.join(UPLOAD_DIR, "newton_faq.xls");
  try {
    if (fs.existsSync(faqXlsx)) {
      const rows = parseXlsxRowsFromBuffer(fs.readFileSync(faqXlsx));
      const text = buildKnowledgeFromRows(rows);
      if (text) return text;
    }
  } catch {}
  try {
    if (fs.existsSync(faqXls)) {
      return "The knowledge base file is .xls. To avoid garbled text, convert it to .xlsx and upload it again.";
    }
  } catch {}
  return "No FAQ knowledge base is available yet.";
}

function buildDemoBootstrap() {
  const projectId = 1201;
  const publishId = 3201;
  const introPath = fs.existsSync(path.join(UPLOAD_DIR, "newton_intro.pdf")) ? "/uploads/newton_intro.pdf" : "/uploads/demo_lesson_ppt.pdf";
  const interactivePath = fs.existsSync(path.join(UPLOAD_DIR, "newton_interactive.html")) ? "/uploads/newton_interactive.html" : "/uploads/demo_interactive.html";
  const summaryPath = fs.existsSync(path.join(UPLOAD_DIR, "newton_summary.pdf")) ? "/uploads/newton_summary.pdf" : "/uploads/demo_lesson_ppt.pdf";
  const faqKnowledge = buildNewtonFaqKnowledge();
  const introPages = estimatePdfPages(path.join(UPLOAD_DIR, path.basename(introPath)));
  const summaryPages = estimatePdfPages(path.join(UPLOAD_DIR, path.basename(summaryPath)));

  const promptConcept = "You are the Concept Q&A Assistant for high-school physics (Newton First Law). Explain inertia, balanced forces, net force, and motion states with short examples. Emphasize that a nonzero net force changes motion. Ask one diagnostic question before conclusions.";
  const promptGuide = "You are the Experiment Inquiry Guide. Lead students to propose hypotheses, identify variables, design procedures, collect data, and explain deviations. Provide hints from easy to advanced.";
  const promptAnalysis = "You are the Experiment Analysis Assistant. Help with data processing, chart interpretation, uncertainty/error analysis, and concise conclusions suitable for classroom summary. State conclusions in terms of resistance and net force, not simply whether any force exists.";

  const modules = [
    {
      id: 2301,
      moduleName: "Course Introduction PPT",
      contentType: "ppt",
      color: "#5f8dff",
      shape: "rounded",
      positionX: 48,
      positionY: 84,
      compile: { ready: true, summary: `Compiled: ${path.basename(introPath)} (about ${introPages} pages)`, data: { type: "ppt", src: introPath, pages: introPages } }
    },
    {
      id: 2302,
      moduleName: "Concept Q&A Assistant",
      contentType: "ai_assistant",
      color: "#20d6bf",
      shape: "circle",
      positionX: 330,
      positionY: 84,
      compile: { ready: true, summary: "AI Assistant configured", data: { type: "ai_assistant", aiConfig: { model: "deepseek-chat", systemPrompt: promptConcept, knowledge: "Topic: Newton's First Law, inertia, balanced forces, net force, and motion states. Answer questions using the classroom introduction content." } } }
    },
    {
      id: 2303,
      moduleName: "Interactive Demo",
      contentType: "interactive",
      color: "#f7b84b",
      shape: "rounded",
      positionX: 612,
      positionY: 84,
      compile: { ready: true, summary: `Compiled: ${path.basename(interactivePath)}`, data: { type: "interactive", src: interactivePath } }
    },
    {
      id: 2304,
      moduleName: "Experiment Inquiry Guide",
      contentType: "ai_assistant",
      color: "#a782ff",
      shape: "diamond",
      positionX: 892,
      positionY: 84,
      compile: { ready: true, summary: "AI Assistant configured", data: { type: "ai_assistant", aiConfig: { model: "deepseek-chat", systemPrompt: promptGuide, knowledge: `Source: student question FAQ knowledge base\n\n${faqKnowledge}` } } }
    },
    {
      id: 2305,
      moduleName: "Class Summary PPT",
      contentType: "ppt",
      color: "#6ed68b",
      shape: "rounded",
      positionX: 1174,
      positionY: 84,
      compile: { ready: true, summary: `Compiled: ${path.basename(summaryPath)} (about ${summaryPages} pages)`, data: { type: "ppt", src: summaryPath, pages: summaryPages } }
    },
    {
      id: 2306,
      moduleName: "Experiment Analysis Assistant",
      contentType: "ai_assistant",
      color: "#f86e9f",
      shape: "hex",
      positionX: 1454,
      positionY: 84,
      compile: { ready: true, summary: "AI Assistant configured", data: { type: "ai_assistant", aiConfig: { model: "deepseek-reasoner", systemPrompt: promptAnalysis, knowledge: "Use this lesson's experiment and summary PPT to focus on error sources, improvement plans, and clear conclusion writing." } } }
    }
  ];

  const connections = [
    { fromModuleId: 2301, toModuleId: 2302 },
    { fromModuleId: 2302, toModuleId: 2303 },
    { fromModuleId: 2303, toModuleId: 2304 },
    { fromModuleId: 2304, toModuleId: 2305 },
    { fromModuleId: 2305, toModuleId: 2306 }
  ];

  const project = {
    id: projectId,
    name: "Newton's First Law Experiment Teaching Demo",
    description: "Intro PPT + interactive demo + classroom summary, with three AI assistants configured.",
    updatedAt: new Date().toISOString(),
    modules,
    connections
  };

  const snapshot = {
    projectId,
    publishId,
    name: project.name,
    description: project.description,
    publishedAt: new Date().toISOString(),
    autoPlay: false,
    autoPlaySeconds: 12,
    modules: modules.map((m) => ({ id: m.id, moduleName: m.moduleName, contentType: m.contentType, compile: JSON.parse(JSON.stringify(m.compile)) })),
    connections: connections.map((c) => ({ ...c })),
    sequence: [2301, 2302, 2303, 2304, 2305, 2306]
  };

  SAMPLE_BOOTSTRAP.currentProjectId = projectId;
  SAMPLE_BOOTSTRAP.projects = [project];
  SAMPLE_BOOTSTRAP.published = [snapshot];
}

ensureDemoAssets();
buildDemoBootstrap();

const MIME_MAP = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "video/ogg",
  ".ogv": "video/ogg",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload, null, 2));
}

function safeBaseName(name) {
  const base = path.basename(String(name || "upload.bin"));
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned || "upload.bin";
}

function readBodyBuffer(req, limitBytes = 300 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", (err) => reject(err));
  });
}

async function handleUpload(req, res) {
  let parsedUrl;
  try {
    parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  } catch {
    sendJson(res, 400, { error: "Bad Request" });
    return;
  }

  const rawName = parsedUrl.searchParams.get("name") || "upload.bin";
  const contentType = (parsedUrl.searchParams.get("contentType") || "").toLowerCase();
  const ext = path.extname(rawName).toLowerCase();

  if (contentType === "interactive" && ![".html", ".htm"].includes(ext)) {
    sendJson(res, 400, { error: "Interactive modules only support HTML/HTM files" });
    return;
  }

  let body;
  try {
    body = await readBodyBuffer(req);
  } catch (err) {
    if (String(err?.message || "").includes("payload too large")) {
      sendJson(res, 413, { error: "File is too large. Please keep it under 300MB." });
      return;
    }
    sendJson(res, 500, { error: "Failed to read uploaded content" });
    return;
  }

  if (!body || !body.length) {
    sendJson(res, 400, { error: "File content is empty" });
    return;
  }

  const safeName = safeBaseName(rawName);
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
  const fullPath = path.join(UPLOAD_DIR, unique);

  fs.writeFile(fullPath, body, (err) => {
    if (err) {
      sendJson(res, 500, { error: "Failed to save file" });
      return;
    }
    sendJson(res, 200, {
      ok: true,
      url: `/uploads/${unique}`,
      originalName: rawName,
      size: body.length,
      uploadedAt: new Date().toISOString()
    });
  });
}

function decodeXmlText(input) {
  return String(input || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function parseCsvText(text, delimiter = ",") {
  const rows = [];
  let row = [];
  let cell = "";
  let q = false;
  const src = String(text || "").replace(/\r\n/g, "\n");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "\"") {
      if (q && src[i + 1] === "\"") {
        cell += "\"";
        i += 1;
      } else {
        q = !q;
      }
      continue;
    }
    if (!q && ch === delimiter) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (!q && ch === "\n") {
      row.push(cell.trim());
      cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell.trim());
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

function normalizeRowsFromTable(tableRows) {
  if (!tableRows.length) return [];
  const header = tableRows[0].map((x) => String(x || "").trim().toLowerCase());
  return tableRows.slice(1).map((line) => {
    const row = {};
    header.forEach((h, idx) => {
      if (h) row[h] = String(line[idx] || "");
    });
    return row;
  }).filter((row) => Object.values(row).some((v) => String(v || "").trim() !== ""));
}

function parseZipBuffer(buffer) {
  const EOCD_SIG = 0x06054b50;
  const CEN_SIG = 0x02014b50;
  const LOC_SIG = 0x04034b50;
  const minEocd = 22;
  const maxScan = Math.max(0, buffer.length - 65557);
  let eocdOffset = -1;
  for (let i = buffer.length - minEocd; i >= maxScan; i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("ZIP parse failed: EOCD not found");

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);
  let ptr = centralDirOffset;
  const entries = [];
  for (let i = 0; i < totalEntries; i += 1) {
    if (ptr + 46 > buffer.length || buffer.readUInt32LE(ptr) !== CEN_SIG) {
      throw new Error("ZIP parse failed: invalid central directory entry");
    }
    const flags = buffer.readUInt16LE(ptr + 8);
    const method = buffer.readUInt16LE(ptr + 10);
    const compressedSize = buffer.readUInt32LE(ptr + 20);
    const nameLen = buffer.readUInt16LE(ptr + 28);
    const extraLen = buffer.readUInt16LE(ptr + 30);
    const commentLen = buffer.readUInt16LE(ptr + 32);
    const localOffset = buffer.readUInt32LE(ptr + 42);
    const nameStart = ptr + 46;
    const nameEnd = nameStart + nameLen;
    const nameBytes = buffer.slice(nameStart, nameEnd);
    let name = "";
    if (flags & 0x0800) {
      name = nameBytes.toString("utf8");
    } else {
      try {
        name = new TextDecoder("gbk").decode(nameBytes);
      } catch {
        name = nameBytes.toString("latin1");
      }
    }
    name = String(name || "").replace(/\\/g, "/");

    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== LOC_SIG) {
      throw new Error("ZIP parse failed: invalid local header");
    }
    const localNameLen = buffer.readUInt16LE(localOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) throw new Error("ZIP parse failed: compressed data out of range");
    const compressed = buffer.slice(dataStart, dataEnd);
    let data;
    if (method === 0) data = compressed;
    else if (method === 8) data = require("zlib").inflateRawSync(compressed);
    else throw new Error(`Unsupported ZIP compression method: ${method}`);
    entries.push({ name, data });
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function parseSharedStrings(xml) {
  const out = [];
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = re.exec(xml))) {
    const si = m[1];
    const tRe = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
    const parts = [];
    let tm;
    while ((tm = tRe.exec(si))) parts.push(decodeXmlText(tm[1]));
    out.push(parts.join(""));
  }
  return out;
}

function parseXlsxRowsFromBuffer(buffer) {
  const entries = parseZipBuffer(buffer);
  const sharedEntry = entries.find((e) => e.name === "xl/sharedStrings.xml");
  const shared = sharedEntry ? parseSharedStrings(sharedEntry.data.toString("utf8")) : [];
  const sheetEntry = entries.find((e) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(e.name));
  if (!sheetEntry) return [];
  const sheetXml = sheetEntry.data.toString("utf8");
  const rowsByCol = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch;
  while ((rowMatch = rowRe.exec(sheetXml))) {
    const rowBody = rowMatch[1];
    const cellMap = {};
    const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g;
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowBody))) {
      const attrs = cellMatch[1] || cellMatch[3] || "";
      const body = cellMatch[2] || "";
      const ref = (attrs.match(/\br="([^"]+)"/) || [])[1] || "";
      const col = ref.replace(/\d/g, "");
      if (!col) continue;
      const t = ((attrs.match(/\bt="([^"]+)"/) || [])[1] || "").trim();
      let value = "";
      if (t === "s") {
        const idx = Number((body.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || -1);
        if (Number.isInteger(idx) && idx >= 0 && idx < shared.length) value = shared[idx];
      } else if (t === "inlineStr") {
        const tRe = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
        const parts = [];
        let tm;
        while ((tm = tRe.exec(body))) parts.push(decodeXmlText(tm[1]));
        value = parts.join("");
      } else {
        const raw = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || "";
        value = decodeXmlText(raw);
      }
      cellMap[col] = value;
    }
    if (Object.keys(cellMap).length) rowsByCol.push(cellMap);
  }
  if (rowsByCol.length < 2) return [];
  const header = rowsByCol[0];
  const map = {};
  Object.keys(header).forEach((col) => {
    const key = String(header[col] || "").trim().toLowerCase();
    if (key) map[col] = key;
  });
  const rows = [];
  for (let i = 1; i < rowsByCol.length; i += 1) {
    const src = rowsByCol[i];
    const row = {};
    Object.keys(map).forEach((col) => {
      row[map[col]] = String(src[col] || "");
    });
    if (Object.values(row).some((v) => String(v).trim() !== "")) rows.push(row);
  }
  return rows;
}

function normalizeQuizType(raw) {
  const t = String(raw || "").trim().toLowerCase();
  if (["single", "radio", "\u5355\u9009"].includes(t)) return "single";
  if (["multiple", "checkbox", "\u591a\u9009"].includes(t)) return "multiple";
  if (["scale", "likert", "\u91cf\u8868"].includes(t)) return "scale";
  return "blank";
}

function getRowValue(row, keys) {
  for (const key of keys) {
    const k = String(key || "").trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(row, k)) return String(row[k] || "");
  }
  return "";
}

function makeImageResolver(zipEntries) {
  const map = new Map();
  const imageExt = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"]);
  for (const e of zipEntries || []) {
    const ext = path.extname(e.name).toLowerCase();
    if (!imageExt.has(ext)) continue;
    const name = path.basename(e.name).toLowerCase();
    const base = path.basename(e.name, ext).toLowerCase();
    if (!map.has(name)) map.set(name, e);
    if (!map.has(base)) map.set(base, e);
  }
  return (ref) => {
    const key = String(ref || "").trim().toLowerCase();
    if (!key) return "";
    const entry = map.get(key);
    if (!entry) return "";
    const safe = path.basename(entry.name).replace(/[^a-zA-Z0-9._-]/g, "_") || "image.bin";
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, unique), entry.data);
    return `/uploads/${unique}`;
  };
}

function buildQuestionsFromRows(rows, imageResolver) {
  const questions = [];
  let counter = 1;
  for (const row of rows) {
    const prompt = getRowValue(row, ["question", "prompt", "\u95ee\u9898", "\u5b66\u751f\u95ee\u9898"]).trim();
    if (!prompt) continue;
    const id = getRowValue(row, ["id", "\u9898\u53f7"]).trim() || `q${counter}`;
    const type = normalizeQuizType(getRowValue(row, ["type", "questiontype", "\u9898\u578b"]));
    const options = getRowValue(row, ["options", "\u9009\u9879"])
      .replace(/\r/g, "")
      .split(/\||\n/)
      .map((x) => x.trim())
      .filter(Boolean);
    const answer = getRowValue(row, ["answer", "\u7b54\u6848"]);
    const imageRef = getRowValue(row, ["image", "\u56fe\u7247"]);
    const q = { id, type, prompt, options, answer };
    const imageUrl = imageResolver ? imageResolver(imageRef) : "";
    if (imageUrl) q.image = imageUrl;
    questions.push(q);
    counter += 1;
  }
  return questions;
}

function parseQuizFromBuffer(inputBuffer, inputName) {
  const ext = path.extname(inputName).toLowerCase();
  const title = path.basename(inputName, ext) || "Quiz";
  if (ext === ".zip") {
    const entries = parseZipBuffer(inputBuffer);
    const pick = (extensions) => entries.find((e) => extensions.some((x) => e.name.toLowerCase().endsWith(x)));
    const source = pick([".xlsx"]) || pick([".json"]) || pick([".csv"]) || pick([".tsv"]) || pick([".txt"]);
    if (!source) throw new Error("ZIP must contain one source file: .xlsx/.json/.csv/.tsv/.txt");
    const sourceExt = path.extname(source.name).toLowerCase();
    const quizTitle = title;
    const resolveImage = makeImageResolver(entries);
    if (sourceExt === ".xlsx") {
      const rows = parseXlsxRowsFromBuffer(source.data);
      const questions = buildQuestionsFromRows(rows, resolveImage);
      return { title: quizTitle, questions };
    }
    if (sourceExt === ".json") {
      const parsed = JSON.parse(source.data.toString("utf8"));
      const sourceRows = Array.isArray(parsed) ? parsed : (parsed.questions || []);
      const questions = sourceRows.map((q, i) => {
        const imageRaw = String(q.image || "");
        const image = resolveImage(imageRaw) || (imageRaw.startsWith("/uploads/") ? imageRaw : "");
        const out = {
          id: String(q.id || `q${i + 1}`),
          type: normalizeQuizType(q.type || q.questionType),
          prompt: String(q.prompt || q.question || "").trim(),
          options: Array.isArray(q.options)
            ? q.options.map((x) => String(x).trim()).filter(Boolean)
            : String(q.options || "").split(/\||\n/).map((x) => x.trim()).filter(Boolean),
          answer: q.answer ?? "",
        };
        if (image) out.image = image;
        return out;
      }).filter((q) => q.prompt);
      return { title: String(parsed.title || quizTitle), questions };
    }
    const text = source.data.toString("utf8");
    const delimiter = sourceExt === ".tsv" ? "\t" : ((sourceExt === ".txt" && (text.split(/\r?\n/)[0] || "").includes("\t")) ? "\t" : ",");
    const rows = normalizeRowsFromTable(parseCsvText(text, delimiter));
    const questions = buildQuestionsFromRows(rows, resolveImage);
    return { title: quizTitle, questions };
  }
  if (ext === ".xlsx") {
    const rows = parseXlsxRowsFromBuffer(inputBuffer);
    return { title, questions: buildQuestionsFromRows(rows, null) };
  }
  if (ext === ".json") {
    const parsed = JSON.parse(inputBuffer.toString("utf8"));
    const sourceRows = Array.isArray(parsed) ? parsed : (parsed.questions || []);
    const questions = sourceRows.map((q, i) => ({
      id: String(q.id || `q${i + 1}`),
      type: normalizeQuizType(q.type || q.questionType),
      prompt: String(q.prompt || q.question || "").trim(),
      options: Array.isArray(q.options)
        ? q.options.map((x) => String(x).trim()).filter(Boolean)
        : String(q.options || "").split(/\||\n/).map((x) => x.trim()).filter(Boolean),
      answer: q.answer ?? "",
      image: q.image ? String(q.image) : "",
    })).filter((q) => q.prompt);
    return { title: String(parsed.title || title), questions };
  }
  if (ext === ".csv" || ext === ".tsv" || ext === ".txt") {
    const text = inputBuffer.toString("utf8");
    const delimiter = ext === ".tsv" ? "\t" : ((ext === ".txt" && (text.split(/\r?\n/)[0] || "").includes("\t")) ? "\t" : ",");
    const rows = normalizeRowsFromTable(parseCsvText(text, delimiter));
    return { title, questions: buildQuestionsFromRows(rows, null) };
  }
  throw new Error("Unsupported quiz format. Use zip/xlsx/csv/tsv/json/txt");
}

async function handleQuizParse(req, res) {
  let parsedUrl;
  try {
    parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  } catch {
    sendJson(res, 400, { error: "Bad Request" });
    return;
  }
  const inputName = parsedUrl.searchParams.get("name") || "quiz.zip";
  const ext = path.extname(inputName).toLowerCase();
  const allowed = new Set([".zip", ".xlsx", ".csv", ".tsv", ".json", ".txt"]);
  if (!allowed.has(ext)) {
    sendJson(res, 400, { error: "Unsupported quiz format. Use zip/xlsx/csv/tsv/json/txt" });
    return;
  }
  let body;
  try {
    body = await readBodyBuffer(req, 100 * 1024 * 1024);
  } catch (err) {
    if (String(err?.message || "").includes("payload too large")) {
      sendJson(res, 413, { error: "Quiz file is too large (max 100MB)" });
      return;
    }
    sendJson(res, 500, { error: "Failed to read quiz upload" });
    return;
  }
  if (!body || !body.length) {
    sendJson(res, 400, { error: "Quiz upload is empty" });
    return;
  }
  try {
    const quiz = parseQuizFromBuffer(body, inputName);
    if (!quiz || !Array.isArray(quiz.questions) || !quiz.questions.length) {
      throw new Error("Quiz parse succeeded but no valid questions were found");
    }
    sendJson(res, 200, { ok: true, quiz });
  } catch (err) {
    sendJson(res, 400, { error: err.message || "Failed to parse quiz file" });
  }
}

function parseKnowledgeFromBuffer(inputBuffer, inputName) {
  const ext = path.extname(String(inputName || "")).toLowerCase();
  if (ext === ".xlsx") {
    const rows = parseXlsxRowsFromBuffer(inputBuffer);
    const text = buildKnowledgeFromRows(rows);
    return text || "[xlsx uploaded, but no usable question/answer rows were found]";
  }
  if (ext === ".xls") {
    return "[xls detected. To avoid garbled text, please save it as .xlsx and upload again.]";
  }
  if (ext === ".csv" || ext === ".tsv" || ext === ".txt" || ext === ".md" || ext === ".markdown" || ext === ".log") {
    return inputBuffer.toString("utf8");
  }
  if (ext === ".json") {
    try {
      const parsed = JSON.parse(inputBuffer.toString("utf8"));
      return JSON.stringify(parsed, null, 2);
    } catch {
      return inputBuffer.toString("utf8");
    }
  }
  // Other types: keep upload but do not force parse.
  return "";
}

async function handleAiKnowledgeUpload(req, res) {
  let parsedUrl;
  try {
    parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  } catch {
    sendJson(res, 400, { error: "Bad Request" });
    return;
  }
  const rawName = parsedUrl.searchParams.get("name") || "knowledge.bin";
  const safeName = safeBaseName(rawName);
  let body;
  try {
    body = await readBodyBuffer(req, 100 * 1024 * 1024);
  } catch (err) {
    if (String(err?.message || "").includes("payload too large")) {
      sendJson(res, 413, { error: "File is too large (max 100MB)" });
      return;
    }
    sendJson(res, 500, { error: "Failed to read uploaded file" });
    return;
  }
  if (!body || !body.length) {
    sendJson(res, 400, { error: "Uploaded file is empty" });
    return;
  }

  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
  const fullPath = path.join(UPLOAD_DIR, unique);
  try {
    fs.writeFileSync(fullPath, body);
  } catch {
    sendJson(res, 500, { error: "Failed to save uploaded file" });
    return;
  }

  let knowledgeText = "";
  try {
    knowledgeText = parseKnowledgeFromBuffer(body, rawName);
  } catch (err) {
    knowledgeText = `[File uploaded, but parsing failed] ${err.message || err}`;
  }

  sendJson(res, 200, {
    ok: true,
    originalName: rawName,
    url: `/uploads/${unique}`,
    size: body.length,
    knowledgeText: String(knowledgeText || "").slice(0, 400000),
    uploadedAt: new Date().toISOString(),
  });
}

async function handleAiChat(req, res) {
  let body;
  try {
    body = await readBodyBuffer(req, 2 * 1024 * 1024);
  } catch (err) {
    if (String(err?.message || "").includes("payload too large")) {
      sendJson(res, 413, { error: "Request payload too large (max 2MB)" });
      return;
    }
    sendJson(res, 500, { error: "Failed to read request" });
    return;
  }

  let payload = {};
  try {
    payload = JSON.parse(String(body || "").trim() || "{}");
  } catch {
    sendJson(res, 400, { error: "Invalid request JSON" });
    return;
  }

  const question = String(payload.question || "").trim();
  if (!question) {
    sendJson(res, 400, { error: "question is required" });
    return;
  }
  const model = String(payload.model || "deepseek-chat").trim() || "deepseek-chat";
  const systemPrompt = String(payload.systemPrompt || "").trim();
  const knowledge = String(payload.knowledge || "").trim();
  const apiKey = String(DEEPSEEK_API_KEY || "").trim();
  if (!apiKey || apiKey === "PASTE_YOUR_DEEPSEEK_API_KEY_HERE") {
    sendJson(res, 500, { error: "DeepSeek API key is not configured. Set DEEPSEEK_API_KEY in the environment or .env file." });
    return;
  }
  if (typeof fetch !== "function") {
    sendJson(res, 500, { error: "Global fetch is unavailable. Please use Node.js 18+." });
    return;
  }

  const systemParts = [];
  if (systemPrompt) systemParts.push(`System prompt:\n${systemPrompt}`);
  if (knowledge) systemParts.push(`Knowledge base:\n${knowledge}`);
  const messages = [];
  if (systemParts.length) messages.push({ role: "system", content: systemParts.join("\n\n") });
  messages.push({ role: "user", content: question });

  let upstream;
  try {
    upstream = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
      }),
    });
  } catch (err) {
    sendJson(res, 502, { error: `Failed to call DeepSeek: ${err.message || err}` });
    return;
  }

  let data = {};
  try {
    data = await upstream.json();
  } catch {
    data = {};
  }
  if (!upstream.ok) {
    const detail = data?.error?.message || data?.error || `HTTP ${upstream.status}`;
    sendJson(res, 502, { error: `DeepSeek returned an error: ${detail}` });
    return;
  }
  const answer = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!answer) {
    sendJson(res, 502, { error: "DeepSeek returned an empty answer" });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    model,
    answer,
    usage: data?.usage || null,
  });
}

function resolvePath(urlPath) {
  let pathname = "/";
  try {
    pathname = decodeURIComponent((urlPath || "/").split("?")[0]);
  } catch {
    return null;
  }
  if (pathname === "/") pathname = "/studio_teaching_strict_demo.html";
  const full = path.resolve(ROOT, `.${pathname}`);
  const relative = path.relative(ROOT, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return full;
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      sendJson(res, 404, { error: "Not Found" });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_MAP[ext] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    sendJson(res, 400, { error: "Bad Request" });
    return;
  }
  if (req.method === "OPTIONS" && req.url.startsWith("/api/")) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }
  if (req.method === "POST" && req.url.startsWith("/api/upload")) {
    handleUpload(req, res);
    return;
  }
  if (req.method === "POST" && req.url.startsWith("/api/quiz-parse")) {
    handleQuizParse(req, res);
    return;
  }
  if (req.method === "POST" && req.url.startsWith("/api/ai/knowledge-upload")) {
    handleAiKnowledgeUpload(req, res);
    return;
  }
  if (req.method === "POST" && req.url.startsWith("/api/ai/chat")) {
    handleAiChat(req, res);
    return;
  }
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method Not Allowed" });
    return;
  }
  if (req.url.startsWith("/api/health")) {
    sendJson(res, 200, { ok: true });
    return;
  }
  if (req.url.startsWith("/api/bootstrap")) {
    sendJson(res, 200, SAMPLE_BOOTSTRAP);
    return;
  }
  const filePath = resolvePath(req.url);
  if (!filePath) {
    sendJson(res, 400, { error: "Bad Request" });
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      sendJson(res, 404, { error: "Not Found" });
      return;
    }
    sendFile(res, filePath);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});



