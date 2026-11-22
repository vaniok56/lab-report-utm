const isAbsolutePath = (value) => typeof value === "string" &&
  (value.startsWith("/") || value.startsWith("\\\\") || /^[A-Za-z]:[\\/]/.test(value));

function validateReport(plan, draft) {
  const fail = (message) => { throw new Error(message); };
  const line = (v, label) => {
    if (typeof v !== "string" || !v.trim() || /[\r\n\t]|⟦|⟧|\[\[|```|\*\*|^#{1,6}\s/.test(v)) {
      fail(`${label}: use nonempty plain text on one line`);
    }
  };
  const keys = (v, names) => v && typeof v === "object" &&
    Object.keys(v).sort().join() === names.split(" ").sort().join();
  if (!keys(draft, "intro tasks conclusion") || !Array.isArray(draft.tasks)) fail("Invalid draft shape");
  const cover = ["course", "lab", "topic", "studentLabel", "student", "teacherLabel", "teacher", "year"];
  const incompleteCover = [];
  for (const k of cover) {
    line(plan.cover?.[k], `Cover ${k}`);
    if (/_{3,}|\bTBD\b/i.test(plan.cover[k])) incompleteCover.push(k);
  }
  if (!/^\d{4}$/.test(plan.cover.year)) fail("Year must be four digits");
  if (plan.cover.department) {
    line(plan.cover.department, "Department");
    if (/_{3,}|\bTBD\b/i.test(plan.cover.department)) incompleteCover.push("department");
  }
  if (incompleteCover.length && plan.allowDraft !== true) {
    fail(`Incomplete cover fields: ${incompleteCover.join(", ")}; ask for confirmed data or set allowDraft`);
  }
  line(draft.intro, "Intro");
  line(draft.conclusion, "Conclusion");
  if (!Array.isArray(plan.tasks) || !plan.tasks.length || plan.tasks.length !== draft.tasks.length) {
    fail("Task count does not match the handout checklist");
  }
  const ids = new Set();
  for (const [i, item] of plan.tasks.entries()) {
    const t = draft.tasks[i];
    line(item.id, "Task ID");
    line(item.title, "Task title");
    line(item.requirement, "Requirement");
    if (ids.has(item.id)) fail(`Duplicate task ${item.id}`);
    ids.add(item.id);
    if (!keys(t, "id paragraphs evidence") || t.id !== item.id) fail(`Expected task ${item.id} in position ${i + 1}`);
    if (!Array.isArray(t.paragraphs) || t.paragraphs.length < 1 || t.paragraphs.length > 3) fail(`Task ${item.id}: expected one to three paragraphs`);
    for (const p of t.paragraphs) {
      line(p, `${item.id} paragraph`);
      if (/^(?:Cerință|Metodă|Rezultat(?:e)?|Verificare|Dovadă)\s*:/i.test(p)) fail(`Task ${item.id}: use connected prose, not checklist labels`);
    }
    if (!Array.isArray(item.evidence) || !Array.isArray(t.evidence) || !t.evidence.length || new Set(t.evidence).size !== t.evidence.length) {
      fail(`Missing or duplicate evidence IDs for task ${item.id}`);
    }
    for (const id of t.evidence) {
      const e = Object.hasOwn(plan.evidence ?? {}, id) && plan.evidence[id];
      if (!item.evidence.includes(id) || e?.checked !== true || !["artifact", "screenshot"].includes(e.kind) ||
          (e.kind === "screenshot" && item.id !== e.task)) fail(`Unverified or misplaced evidence ${id} for task ${item.id}`);
      line(e.label, `Evidence label ${id}`);
      if (e.kind === "screenshot") {
        if (!isAbsolutePath(e.path) || !/\.png$/i.test(e.path)) fail(`Screenshot ${id} needs an absolute PNG path`);
        line(e.caption, `Evidence caption ${id}`);
        if (e.display && (![e.display.width, e.display.height].every(v => Number.isFinite(v) && v > 0) ||
            e.display.width > 464 || e.display.height > 540 ||
            !["left", "right", "top", "bottom"].every(k => (e.display[k] ?? 0) >= 0 && (e.display[k] ?? 0) <= 0.95) ||
            (e.display.left ?? 0) + (e.display.right ?? 0) >= 0.95 ||
            (e.display.top ?? 0) + (e.display.bottom ?? 0) >= 0.95)) fail(`Invalid screenshot display for ${id}`);
      }
    }
    if (item.command !== undefined && (typeof item.command !== "string" || !item.command.trim() || item.command.includes("[["))) fail(`Invalid command for ${item.id}`);
  }
  const idPattern = /^[a-z][a-z0-9-]*$/;
  const tableIds = new Set();
  for (const table of plan.tables ?? []) {
    line(table.caption, "Table caption");
    if (!idPattern.test(table.id ?? "") || tableIds.has(table.id)) fail(`Invalid or duplicate table ID ${table.id}`);
    tableIds.add(table.id);
    if (table.after !== "intro" && !ids.has(table.after)) fail(`Unknown table placement ${table.after}`);
    const n = table.widths?.length;
    if (!n || table.widths.some(w => !Number.isFinite(w) || w <= 0) ||
        Math.abs(table.widths.reduce((a,b) => a+b) - 100) > 0.001 ||
        !Array.isArray(table.values) || table.values.length < 2 ||
        table.values.some(r => !Array.isArray(r) || r.length !== n)) fail(`Invalid table: ${table.caption}`);
    for (const row of table.values) for (const v of row) if (v !== "") line(v, "Table cell");
  }
  for (const src of plan.sources ?? []) line(src, "Source");
  for (const a of plan.appendix ?? []) {
    line(a.name, "Appendix name");
    if (typeof a.text !== "string" || !a.text.trim()) fail(`Empty listing: ${a.name}`);
  }
  if (plan.reproduce) line(plan.reproduce, "Reproduction instructions");
  for (const token of plan.inlineCode ?? []) line(token, "Code token");
  if ((plan.screenshotTasks ?? []).some(id => !ids.has(id))) fail("Unknown task in screenshot requirements");
  const missing = (plan.screenshotTasks ?? []).filter(id => !draft.tasks.find(t => t.id === id).evidence.some(ev => plan.evidence[ev].kind === "screenshot"));
  if (missing.length && plan.allowDraft !== true) fail(`Real screenshots missing for: ${missing.join(", ")}`);
  const references = new Map();
  let tableNo = 0, figNo = 0;
  const checkRefs = (placement, paragraphs, screenshotIds) => {
    const expected = new Set();
    for (const t of (plan.tables ?? []).filter(t => t.after === placement)) {
      const key = `table:${t.id}`;
      expected.add(key);
      references.set(key, ++tableNo);
    }
    for (const id of screenshotIds) {
      if (!idPattern.test(id)) fail(`Invalid screenshot ID ${id}`);
      const key = `figure:${id}`;
      expected.add(key);
      references.set(key, ++figNo);
    }
    for (const p of paragraphs) {
      if (/[{}]/.test(p.replace(/\{(?:table|figure):[a-z][a-z0-9-]*\}/g, "")) ||
          /\b(?:figura|tabelul)\s+\d/i.test(p)) fail(`Invalid or manually numbered reference in ${placement}`);
      for (const match of p.matchAll(/\{((?:table|figure):[a-z][a-z0-9-]*)\}/g)) {
        if (!expected.delete(match[1])) fail(`Unknown, misplaced or repeated reference: ${match[1]}`);
      }
    }
    if (expected.size) fail(`Missing references in ${placement}: ${[...expected].join(", ")}`);
  };
  checkRefs("intro", [draft.intro], []);
  for (const t of draft.tasks) checkRefs(t.id, t.paragraphs, t.evidence.filter(id => plan.evidence[id].kind === "screenshot"));
  checkRefs("conclusion", [draft.conclusion], []);
  return { missing, incompleteCover, draftOnly: missing.length > 0 || incompleteCover.length > 0, references };
}

async function composeReport(wc, templatePath, plan, draft, docxPath) {
  const gate = validateReport(plan, draft);
  if (!isAbsolutePath(docxPath) || !/\.docx$/i.test(docxPath)) throw new Error("Use an unused absolute DOCX output path");
  const C = (command, params = {}) => ({ command, params });
  const at = (path, off = 0) => C("caret.set", { pos: { story: "body", path, off } });
  const select = text => C("select.text", { text });
  const style = style => C("para.style", { style });
  const text = text => C("text.insert", { text, raw: true });
  const alreadyOpen = new Set((await wc.list_documents()).documents.map(d => d.id));
  await wc.execute({ command: "file.newFromTemplate", params: { path: templatePath, replaceBlank: false } });
  const doc = (await wc.list_documents()).documents.find(d => d.active)?.id;
  if (doc === undefined || alreadyOpen.has(doc)) throw new Error("Could not identify a new report; no document was edited");
  const send = async (commands) => {
    for (let offset = 0; offset < commands.length; offset += 180) {
      const batch = commands.slice(offset, offset + 180);
      const r = await wc.batch({ doc, commands: batch });
      if (!Array.isArray(r) || r.length !== batch.length || r.some(s => !s.ok)) {
        throw new Error(`WordCraft batch stopped: ${JSON.stringify(Array.isArray(r) ? r.at(-1) : r)}`);
      }
    }
  };
  const q = [], tables = [];
  const tags = {
    DEPARTMENT: plan.cover.department, COURSE: plan.cover.course, LAB: plan.cover.lab, TOPIC: plan.cover.topic,
    STUDENT_LABEL: plan.cover.studentLabel, STUDENT: plan.cover.student,
    TEACHER_LABEL: plan.cover.teacherLabel, TEACHER: plan.cover.teacher, YEAR: plan.cover.year,
  };
  for (const [key, value] of Object.entries(tags)) {
    q.push(select(`[[${key}]]`), value ? text(value) : C("text.delete"));
  }
  q.push(C("file.properties", { title: plan.cover.topic }), select("[[BODY]]"));
  let fresh = true, figNo = 0;
  const tokens = [...new Set(plan.inlineCode ?? [])].sort((a,b) => b.length-a.length);
  const matcher = tokens.length ? new RegExp(`(?<![\\p{L}\\p{N}_])(${tokens.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\p{L}\\p{N}_])`, "gu") : null;
  const emit = (value) => {
    if (!matcher) q.push(text(value));
    else for (let i = 0, parts = value.split(matcher); i < parts.length; i++) {
      if (!parts[i]) continue;
      if (i % 2) q.push(C("format.set", { props: { font: "Courier New", noProof: true } }), text(parts[i]), C("format.resetChar"));
      else q.push(text(parts[i]));
    }
  };
  const prose = value => value.replace(/\{((table|figure):[a-z][a-z0-9-]*)\}/g, (token, key, type, offset, src) => {
    const start = !offset || /[.!?]\s+$/.test(src.slice(0, offset));
    const label = type === "table" ? "tabelul" : "figura";
    return `${start ? label[0].toUpperCase() + label.slice(1) : label} ${gate.references.get(key)}`;
  });
  const paragraph = (role, value, label) => {
    if (!fresh) q.push(C("text.newParagraph"));
    q.push(style(role));
    if (label) q.push(C("format.set", { props: { bold: true } }), text(label), C("format.resetChar"), text(" "));
    if (value !== undefined) emit(value);
    fresh = false;
  };
  const literal = (role, b) => {
    paragraph(role);
    q.push(text(b || " "));
  };
  const caption = (label, n, description, keepNext) => {
    paragraph(keepNext ? "UTM Table Caption" : "UTM Caption");
    q.push(text(`${label} `), C("insert.field", { instr: `SEQ ${label} \\* ARABIC`, result: String(n) }), text(` — ${description}`));
  };
  const insertTables = where => {
    for (const t of (plan.tables ?? []).filter(t => t.after === where)) {
      caption("Tabelul", gate.references.get(`table:${t.id}`), t.caption, true);
      q.push(C("insert.spreadsheet", { values: t.values, style: "UTM Grid", header: true }), C("caret.docEnd"));
      tables.push(t);
      fresh = true;
    }
  };
  paragraph("Heading 1", "Scopul și obiectivele lucrării");
  if (gate.draftOnly) paragraph("UTM Draft", "VERSIUNE DE LUCRU — date incomplete sau capturi lipsă.");
  paragraph("Normal", prose(draft.intro));
  insertTables("intro");
  paragraph("Heading 1", "Sarcina individuală");
  for (const [i, t] of draft.tasks.entries()) {
    const task = plan.tasks[i];
    paragraph("Heading 2", `${t.id}. ${task.title}`);
    for (const p of t.paragraphs) paragraph("UTM Evidence Prose", prose(p));
    if (task.command) for (const l of task.command.split(/\r?\n/)) literal("UTM Command", l);
    insertTables(t.id);
    for (const id of t.evidence) {
      const e = plan.evidence[id];
      if (e.kind !== "screenshot") continue;
      const n = gate.references.get(`figure:${id}`);
      figNo++;
      paragraph("UTM Figure");
      q.push(C("insert.picture", { path: e.path, alt: e.label, width: e.display?.width ?? 425 }));
      if (e.display) q.push(C("picture.crop", e.display));
      // Image and editable caption occupy one keep-lines paragraph.
      q.push(C("text.lineBreak"), text("Figura "), C("insert.field", { instr: "SEQ Figura \\* ARABIC", result: String(n) }),
        text(` — ${e.caption}`));
    }
  }
  paragraph("Heading 1", "Concluzii");
  paragraph("Normal", draft.conclusion);
  if (plan.sources?.length) {
    paragraph("Heading 1", "Bibliografie");
    for (const [i, source] of plan.sources.entries()) {
      paragraph(plan.sources.length <= 4 && i < plan.sources.length - 1 ? "UTM Reference Lead" : "UTM Result", `[${i + 1}] ${source}`);
    }
  }
  if (plan.appendix?.length) {
    paragraph("Heading 1", "Anexă — Codul sursă");
    if (plan.reproduce) paragraph("UTM Result", plan.reproduce, "Rulare:");
    for (const a of plan.appendix) {
      paragraph("Heading 2", a.name);
      for (const l of a.text.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n")) literal("UTM Code", l);
    }
  }
  await send(q);
  const mid = await wc.inspect_document({ doc });
  const found = mid.blocks.filter(b => b.type === "table" && b.style === "UTMGrid");
  if (found.length < tables.length) throw new Error("A table did not acquire UTM Grid");
  // Inserted tables are the last ones; a template cover may already use the style.
  const actual = tables.length ? found.slice(-tables.length) : [];
  const post = [C("caret.docEnd")];
  // Set breaks after typing so following paragraphs don't inherit them.
  for (const b of mid.blocks) {
    if (b.style === "Heading1" && ["Concluzii", "Bibliografie", "Anexă — Codul sursă"].includes(b.text)) {
      post.push(at([b.index]), C("para.pageBreakBefore", { value: true }));
    }
  }
  for (const [i, t] of actual.entries()) {
    post.push(at([t.index, 0, 0, 0]), C("table.selectTable"), C("table.properties", { allowBreak: false }));
    for (let col = 0; col < t.cols; col++) post.push(at([t.index, 0, col, 0]), C("table.columnWidth", { width: tables[i].widths[col] * 4.64 }));
    for (let row = 0; row < t.rows; row++) for (let col = 0; col < t.cols; col++) {
      post.push(at([t.index, row, col, 0]), style(row === 0 ? "UTM Table Head" : "UTM Table Body"));
      if (t.rows <= 6 && row > 0 && row < t.rows - 1) post.push(C("para.set", { props: { keepNext: true } }));
    }
  }
  post.push(C("tools.detachTemplate"), C("references.updateFields", { all: true }), C("file.saveAs", { path: docxPath }));
  await send(post);
  return { doc, draftOnly: gate.draftOnly, missingScreenshots: gate.missing, incompleteCover: gate.incompleteCover, tables: tables.length, figures: figNo };
}

if (typeof module !== "undefined") module.exports = { validateReport, composeReport };
