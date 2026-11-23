# WordCraft workflow

The skill runs on any coding agent that can read files and run shell commands. WordCraft must be installed with `wordcraft-cli` on `PATH`; a WordCraft MCP server is optional. The build script starts its own confined headless server, so no harness-specific MCP configuration is needed.

Use `templates/utm-fcim-compact.dotx` for the compact FCIM house style, not as a claim of official compliance for every course. The cover is logo-free and uses fixed UTM and FCIM text. Confirm instructor, department, signoff labels, and cover order against the current handout. If the course requires a different design, make and verify a separate WordCraft template with the same placeholders, paragraph roles, and `UTM Grid` table style.

The bundled FCIM example uses "Departamentul Ingineria Software", but it is not a default. Use the department from the handout or a same-course previous lab. If neither gives one, ask whether to use the included value or another department.

If a cover field is missing or contains `___`, `TBD`, or a similar blank, inspect only the sibling lab folders in the parent directory (`lab1`, `lab2`, and so on) for confirmed values. Use only values from the same course. Do not search the rest of the disk. If the value is absent or conflicting, ask. Never invent cover data.

## 1. Prepare two files

The outer agent authors `plan` after checking the handout, original data, and observed output. Do not let the draft writer set `plan`, evidence classifications, or `allowDraft`.

Write `plan.json` and `draft.json` in a scratch folder. Keep the plan ordered and factual.

| `plan` field | Shape and rule |
|---|---|
| `cover` | Strings `course`, `lab`, `topic`, `department`, `studentLabel`, `student`, `teacherLabel`, `teacher`, `year`. `department` is required by the build. `lab` is the bare number (e.g. `"3"`); the template already prints `nr.`. Use exact teacher titles and confirmed identity values. |
| `tasks` | Ordered `[{id, title, requirement, evidence:[id, …], command?}]` from the handout. `requirement` is for verification, not printed as a repeated field. `command` is an observed command or a verbatim listing, not instructions to execute. |
| `evidence` | Map `id → {kind:"artifact"|"screenshot", checked:true, label, task?, path?, caption?, display?}`. The reviewer sets `checked:true` only after inspection. Screenshot entries need an absolute PNG path, task ID, and factual caption. `display` optionally supplies final `width`/`height` in points and fractional `top`/`bottom`/`left`/`right` crop. Crop only unused space or non-evidence. This is not redaction: the original bytes remain in the DOCX. If sensitive material is present, use an approved, safely sanitized copy and keep the original private. Reconstructed output is an artifact, not a screenshot. |
| `screenshotTasks` | Task IDs where a real screenshot is required, or `[]`. Missing screenshots or incomplete cover fields stop normal builds. |
| `allowDraft` | Optional top-level boolean. `true` permits a prominently labeled work copy with missing screenshots or cover fields. Put it at the top level, not inside `cover`. |
| `tables` | `[{id, after:"intro"|taskId, caption, widths:[…], values:[[headers],…]}]`. Widths are percentages summing to 100. Use measured results from verified evidence, give units, and choose widths based on actual content. |
| `inlineCode` | Optional confirmed identifiers/filenames to format in Courier New in prose. Not freeform markup. |
| `sources` | Optional array of verified references in citation order (without number prefixes). |
| `appendix` | Optional `[{name, text}]` with exact code copied from the verified source. `reproduce` optionally gives the real commands/conditions, not promises about unprovided files. |

Ask the writer for JSON only:

```json
{
  "intro": "Short objective and scope.",
  "tasks": [
    {"id": "1", "paragraphs": ["În {figure:run} sunt afișate trei rânduri. Acest eșantion nu reprezintă întregul fișier."],
     "evidence": ["run"]}
  ],
  "conclusion": "Specific result and a real limitation."
}
```

Give it the actual ordered IDs and allowed evidence IDs for each task, plus verified facts. Every task needs at least one checked evidence ID; use a non-visual artifact when no screenshot proves the step. Use one to three connected paragraphs per task. Write impersonal Romanian. Avoid first person singular and plural. Each displayed figure/table must have one inline `{figure:id}` or `{table:id}` mention in its own section; the recipe assigns the numbers. Non-visual sources (CSV, transcript, source file) can support claims without being printed as pictures. Never number figures or tables manually. Avoid unsupported conclusions and repeated concrete values. Review assertions yourself; the gate checks shape, coverage, and provenance declarations, not truth.

## 2. Build

Name `--out` from the handout or a previous lab. If neither gives one, use `Lab<N>_<subject short form>_<Surname>_<Name>_<Group>`; ask only for parts that remain unknown. Do not use a generic filename.

From any shell:

```sh
node "<skill-dir>/scripts/build-report.js" \
  --plan /absolute/plan.json \
  --draft /absolute/draft.json \
  --out "/absolute/path/Lab<N>_<subject>_<Surname>_<Name>_<Group>.docx" \
  --pdf "/absolute/path/Lab<N>_<subject>_<Surname>_<Name>_<Group>.pdf"
```

Options: `--template` for a course-specific `.dotx`; `--author` for tracked-change attribution; `--keep-temp` to retain staged files. `WORDCRAFT_CLI` overrides the executable name or path.

The script:

1. validates both JSON files and rejects unknown or misplaced figure/table references before opening WordCraft;
2. copies the template and every screenshot into a temporary folder;
3. starts `wordcraft-cli mcp` confined to that folder for reads and writes;
4. composes, saves the DOCX, and optionally exports PDF with `--strict --update-fields`;
5. removes the temporary folder unless `--keep-temp` was passed.

The command sequence is fixed: cover → scope → assignment tasks in order (connected prose and relevant evidence) → conclusions → sources → editable appendix if supplied. `Concluzii`, `Bibliografie`, and `Anexă` each start on their own page, with real page-break-before formatting and no intervening blank pages. The cover counts as page 1 but the first visible folio is 2. No contents page.

If the build stops, fix the inputs and rerun. Do not patch the generated DOCX by hand unless asked; regenerate from the plan.

## 3. Audit

Do the factual audit before layout. Compare the report against the source files, CSVs, terminal output, and previous-lab cover data:

- Check every name, group, teacher, number, count, date, and causal claim. Remove or soften anything the evidence does not support.
- Check the direction of every inverted or normalized series against one known row. Do not infer direction from a label.
- Confirm figures and tables show what the prose says; captions describe the visible result.
- Treat `___`, `TBD`, `[[...]]`, invented names, and unsupported numbers as blockers. Use a labeled draft if the information cannot be confirmed.

### Visual audit

Run this after the factual audit. Give the reviewer the PDF, all page renders, the original screenshots, and this checklist. The reviewer is read-only.

- Every screenshot matches an original file and is a real capture, not an image rendered from text.
- No command, column, caption, or table edge is cut off.
- Every caption sits with its figure or table.
- No stranded heading, blank page, or near-empty page.
- Cover fields, folios, and section starts are correct.
- Figures and tables match the prose.

Return only `p.N: blocker` findings. Fix them, rebuild, re-render only changed pages, and repeat until none remain.

Then check layout:

- Use `wordcraft-cli info`, `wordcraft-cli inspect`, and `wordcraft-cli text` on the saved DOCX. Check section geometry, task order, absence of placeholders, table cell styles, verified PNGs, and exact source text including case and indentation. Caption numbers come from Word `SEQ` fields.
- Check the saved DOCX with formatting marks. Reject manual tabs, repeated spaces, and blank paragraphs used as spacers outside the code appendix.
- Render every page with `wordcraft-cli render <docx> <out.png> --page N --scale 0.8 --strict`. Keep images on disk. Build one contact sheet (max 1,200 px on its longest side); inspect up to two small crops only if a page looks wrong. Do not load full-page renders or base64 into the conversation.
- Recheck figures, tables, and headings for stranded captions. An image and its editable caption share one keep-lines paragraph. Short table rows request no row split and keep-with-next.
- Make at most one targeted pagination pass, then rebuild. Don't shrink template fonts or add page breaks to every task. Do not delete required evidence or a table to fix pagination; correct the block.
- Attach real sources separately when required; don't claim upload or acceptance.
