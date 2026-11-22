---
name: lab-report-utm
description: Draft, assemble, and audit university laboratory reports with WordCraft. Use when the user says “write me the report for this lab”, “write a lab report”, “scrie raportul pentru laborator”, “raport de laborator”, “lucrare de laborator”, or an equivalent request in a lab project. Romanian reports by default. Not for generic DOCX editing or implementing lab code alone.
---

# UTM lab reports

Use the actual course handout and approved example, not a generic UTM standard. Write instructions and handoff in the user's language. The bundled recipe writes Romanian report prose and Romanian section labels; for another report language, adapt the recipe or template. Keep course and student data outside the skill.

## Start

If invoked without a request, inspect the current working folder read-only. Look for a handout or plan, source or notebooks, results, and screenshots. Do not search elsewhere for a different lab.

- If it looks like a lab, name the folder and any identifiable lab number or topic, then ask: “Should I write the report for this lab?” Ask even if the match is obvious.
- Otherwise, ask which lab the user wants and request its folder path or assignment.

Stop after the question. Do not create, edit, render, or export a report until the user confirms the lab or supplies one.

### Cover data

If a cover field is missing or contains `___`, `TBD`, or a similar blank, check only the sibling lab folders in the parent directory (`lab1`, `lab2`, and so on) for a confirmed student, group, teacher, course, or year. Do not search the rest of the disk. If the value is absent or conflicting, ask. Never invent cover data. If the run is non-interactive, use a clearly labeled draft instead of a final-looking report.

## Write the report

1. **Read the real assignment and collect evidence first.** Make an ordered checklist of every required task/subtask, cover fields, evidence, and attachments. Record observed results and limits. Ask once for missing information; don't invent observations or run supplied code automatically. Never claim an attachment is included when it isn't.
2. **Write a report, not a filled-in form.** Keep the ordered checklist and evidence inventory in the trusted `plan`. The `draft` contains connected prose: what was done, what the evidence shows, and what follows. Don't print repeated `Cerință / Metodă / Rezultat / Verificare` labels. A table gives exact values; a figure shows evidence or a pattern; prose explains why it matters and what it does not prove. Don't repeat the same data in all three. Follow [the workflow schema](references/workflow.md), then verify claims against the files. Delegate only if requested.
3. **Compose with WordCraft only.** Use `templates/utm-fcim-compact.dotx` and the build script. Do not hand-build OOXML or use python-docx, pandoc, or LibreOffice. For a different course cover, make a WordCraft template with the same placeholders, paragraph roles, and `UTM Grid` table style. No auto-generated contents and no page per task.
4. **Build from the shell.** `scripts/build-report.js` starts a confined headless WordCraft server, validates both JSON files, composes, and saves the DOCX. It stages screenshots and the template in a temporary folder, so WordCraft needs no access to the rest of the project. Pass `--pdf` to export A4 PDF.
5. **Run a final factual audit.** After the build, compare every concrete name, group, teacher, number, count, date, and causal claim against the source files, CSVs, terminal output, and previous-lab cover data. Check the direction of every inverted or normalized series against one known row. Remove or soften anything the evidence does not support. Incomplete cover data, placeholders, or invented facts mean a labeled draft, never a final-looking report.
6. **Verify layout before delivery.** Inspect task coverage, statement-to-evidence links, exact source, and fields. Render all pages to local files; never load full-page images or batches into the model. Check a single contact sheet and at most two small crops. Missing required screenshots mean a clearly labeled draft. Verify the saved DOCX too.
7. Save a new DOCX. Never overwrite an existing report or imply submission. If factual or visual checks remain unfinished, say so.

A typical build:

```sh
node "<skill-dir>/scripts/build-report.js" \
  --plan plan.json --draft draft.json \
  --out "/absolute/path/Lab3 Report.docx" \
  --pdf "/absolute/path/Lab3 Report.pdf"
```

`plan.json` and `draft.json` are temporary working files based on the schema in `references/workflow.md`. Delete them or leave them with the lab sources; do not add student data to the skill.

`Concluzii`, `Bibliografie`, and `Anexă` each start on a separate page. Each section flows if it is longer than a page. Omitted sections add no pages. The cover counts as page 1 but the first visible folio is 2.

Use the compact FCIM template as an example, not as proof of official compliance. Confirm instructor, department, signoff labels, and cover order against the current handout.
