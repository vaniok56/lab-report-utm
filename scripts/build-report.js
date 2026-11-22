#!/usr/bin/env node
"use strict";

const { spawn, spawnSync } = require("node:child_process");
const { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const readline = require("node:readline");
const { validateReport, composeReport } = require("../recipes/compose.js");

let temp;
const fail = (message) => {
  console.error(`build-report: ${message}`);
  if (temp && !opts.keepTemp) rmSync(temp, { recursive: true, force: true });
  process.exit(1);
};

const opts = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === "--keep-temp") {
    opts.keepTemp = true;
    continue;
  }
  if (!arg.startsWith("--")) fail(`unexpected argument: ${arg}`);
  const value = argv[++i];
  if (!value || value.startsWith("--")) fail(`${arg} needs a value`);
  opts[arg.slice(2)] = value;
}
const allowed = new Set(["plan", "draft", "out", "pdf", "template", "author", "keepTemp"]);
for (const key of Object.keys(opts)) if (!allowed.has(key)) fail(`unknown option --${key}`);
for (const key of ["plan", "draft", "out"]) if (!opts[key]) fail(`--${key} is required`);

const absolute = (value) => path.resolve(process.cwd(), value);
const planPath = absolute(opts.plan);
const draftPath = absolute(opts.draft);
const outPath = absolute(opts.out);
const pdfPath = opts.pdf ? absolute(opts.pdf) : null;
const templatePath = absolute(opts.template || path.join(__dirname, "..", "templates", "utm-fcim-compact.dotx"));
const cli = process.env.WORDCRAFT_CLI || "wordcraft-cli";

if (!outPath.toLowerCase().endsWith(".docx")) fail("--out must be a .docx path");
if (pdfPath && !pdfPath.toLowerCase().endsWith(".pdf")) fail("--pdf must be a .pdf path");
for (const [label, file] of [["plan", planPath], ["draft", draftPath], ["template", templatePath]]) {
  if (!existsSync(file)) fail(`${label} not found: ${file}`);
}
if (existsSync(outPath)) fail(`refusing to overwrite existing report: ${outPath}`);
if (pdfPath && existsSync(pdfPath)) fail(`refusing to overwrite existing PDF: ${pdfPath}`);

const readJson = (label, file) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    fail(`invalid ${label} JSON: ${error.message}`);
  }
};
const plan = readJson("plan", planPath);
const draft = readJson("draft", draftPath);
try {
  validateReport(plan, draft);
} catch (error) {
  fail(error.message);
}

temp = mkdtempSync(path.join(tmpdir(), "utm-report-"));
const tempTemplate = path.join(temp, "template.dotx");
const tempReport = path.join(temp, "report.docx");
const evidenceDir = path.join(temp, "evidence");
mkdirSync(evidenceDir);
copyFileSync(templatePath, tempTemplate);

const staged = structuredClone(plan);
for (const [id, evidence] of Object.entries(staged.evidence || {})) {
  if (evidence.kind !== "screenshot") continue;
  if (!/^[a-z][a-z0-9-]*$/.test(id)) fail(`invalid evidence ID: ${id}`);
  if (typeof evidence.path !== "string" || !existsSync(path.resolve(evidence.path))) {
    fail(`screenshot ${id} not found: ${evidence.path}`);
  }
  const stagedPath = path.join(evidenceDir, `${id}.png`);
  copyFileSync(path.resolve(evidence.path), stagedPath);
  evidence.path = stagedPath;
}

let child;
const cleanup = () => {
  if (child && !child.killed) child.kill();
  if (!opts.keepTemp) rmSync(temp, { recursive: true, force: true });
  else console.error(`build-report: staged files kept in ${temp}`);
};

async function main() {
  child = spawn(cli, [
    "mcp",
    "--automation-read-root", temp,
    "--automation-write-root", temp,
    ...(opts.author ? ["--author", opts.author] : []),
  ], { stdio: ["pipe", "pipe", "inherit"] });

  child.on("error", (error) => {
    console.error(`build-report: could not start ${cli}: ${error.message}`);
    cleanup();
    process.exit(1);
  });

  let seq = 0;
  let stopped = false;
  const pending = new Map();
  const closed = new Promise((resolve) => child.once("close", resolve));
  const stopPending = (error) => {
    if (stopped) return;
    stopped = true;
    for (const pair of pending.values()) pair.reject(error);
    pending.clear();
  };
  child.on("exit", (code, signal) => {
    stopPending(new Error(`WordCraft MCP exited (${code ?? signal ?? "unknown"})`));
  });
  readline.createInterface({ input: child.stdout }).on("line", (line) => {
    let response;
    try {
      response = JSON.parse(line);
    } catch {
      return;
    }
    const pair = pending.get(response.id);
    if (!pair) return;
    pending.delete(response.id);
    if (response.error) pair.reject(new Error(JSON.stringify(response.error)));
    else pair.resolve(response.result);
  });

  const rpc = (method, params = {}) => new Promise((resolve, reject) => {
    if (stopped) {
      reject(new Error("WordCraft MCP stopped"));
      return;
    }
    const id = ++seq;
    const timer = setTimeout(() => {
      if (pending.delete(id)) reject(new Error(`WordCraft MCP timed out during ${method}`));
    }, 120000);
    pending.set(id, {
      resolve: (value) => { clearTimeout(timer); resolve(value); },
      reject: (error) => { clearTimeout(timer); reject(error); },
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });

  const initialized = await rpc("initialize", {
    protocolVersion: "2026-06-18",
    capabilities: {},
    clientInfo: { name: "lab-report-utm", version: "1" },
  });
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);

  const call = async (name, args = {}) => {
    const result = await rpc("tools/call", { name, arguments: args });
    if (result.isError) throw new Error(`${name}: ${result.content?.[0]?.text || "tool error"}`);
    return JSON.parse(result.content[0].text);
  };
  const wc = Object.fromEntries(
    ["execute", "batch", "list_documents", "inspect_document"].map((name) => [
      name,
      (args) => call(name, args),
    ]),
  );

  const result = await composeReport(wc, tempTemplate, staged, draft, tempReport);
  child.stdin.end();
  await closed;

  if (pdfPath) {
    const tempPdf = path.join(temp, "report.pdf");
    const converted = spawnSync(cli, ["convert", tempReport, tempPdf, "--strict", "--update-fields"], {
      stdio: "inherit",
    });
    if (converted.status !== 0) throw new Error(`PDF export failed with exit code ${converted.status}`);
    mkdirSync(path.dirname(pdfPath), { recursive: true });
    copyFileSync(tempPdf, pdfPath);
  }

  mkdirSync(path.dirname(outPath), { recursive: true });
  copyFileSync(tempReport, outPath);

  const info = spawnSync(cli, ["info", outPath], { encoding: "utf8" });
  let pages;
  try {
    if (info.status === 0) pages = JSON.parse(info.stdout).pages;
  } catch {
    pages = undefined;
  }
  console.log(JSON.stringify({
    server: initialized.serverInfo,
    report: outPath,
    pdf: pdfPath,
    pages,
    figures: result.figures,
    tables: result.tables,
    draftOnly: result.draftOnly,
    missingScreenshots: result.missingScreenshots,
    incompleteCover: result.incompleteCover,
  }, null, 2));
}

main().catch((error) => {
  console.error(`build-report: ${error.message}`);
  cleanup();
  process.exit(1);
}).then(() => cleanup());
