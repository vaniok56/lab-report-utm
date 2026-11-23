# UTM lab reports

This fork turns the Claude Code and Windows Word/python-docx workflow into a portable Agent Skills skill for Claude Code, Codex, and OpenCode, built on a standalone WordCraft CLI. It adds validated plan/draft inputs, cover fallback and placeholder blocking, a real-screenshot evidence gate, separate conclusions/bibliography/appendix pages, and an installer, while removing the old Python builder, Windows renderer, profile, logo, and Word-specific reference files.

Forked from [Flikkery/lab-report-utm](https://github.com/Flikkery/lab-report-utm). Upstream does not declare a license. This project targets short lab reports, not long internship reports. The bundled template is an example, not an official university standard.

## Requirements

- Node.js 18 or newer.
- WordCraft with `wordcraft-cli` on `PATH`.
- A coding agent with file and shell access.
- WordCraft MCP configuration is not required. The build script starts its own confined server.

Check the tools:

```sh
wordcraft-cli --version
node --version
```

## Install

```sh
git clone https://github.com/vaniok56/lab-report-utm.git
cd lab-report-utm
./scripts/install.sh claude
./scripts/install.sh codex
./scripts/install.sh opencode
```

Install all three:

```sh
./scripts/install.sh all
```

The installer copies the skill. Use `--link` to symlink its shipped files, so `git pull` updates installed skills:

```sh
./scripts/install.sh all --link
```

It never overwrites an existing skill or command. It reports skipped paths.

| Agent | Skill location | Invocation |
|---|---|---|
| Claude Code | `~/.claude/skills/lab-report-utm/` | `/lab-report-utm` |
| Codex | `~/.agents/skills/lab-report-utm/` | `$lab-report-utm` |
| OpenCode | `~/.config/opencode/skills/lab-report-utm/` plus `~/.config/opencode/commands/lab-report-utm.md` | `/lab-report-utm` |

For a project-only install, copy `SKILL.md`, `references/`, `recipes/`, `scripts/`, and `templates/` into `.claude/skills/lab-report-utm/`, `.agents/skills/lab-report-utm/`, or `.opencode/skills/lab-report-utm/`. OpenCode also needs `.opencode/commands/lab-report-utm.md`.

`scripts/install.sh` is POSIX. On Windows, copy the same folders manually.

## Use

Open the agent in the lab folder with the assignment, source, results, and original screenshots.

```text
/lab-report-utm write me the report for this lab
```

The skill can also load from a request such as "scrie raportul pentru laborator".

With no request:

```text
/lab-report-utm
```

it inspects the current folder. If it finds a lab, it names it and asks before writing. Otherwise it asks which lab to use. It writes nothing until you confirm.

If cover fields are missing or contain placeholders, the skill checks only sibling lab folders (`lab1`, `lab2`, and so on) for the same course. If the value is absent or conflicting, it asks. It does not search the rest of the disk and does not invent student or teacher data.

The build requires department. If no same-course lab provides it, the skill asks whether to use "Departamentul Ingineria Software" or another department. It never applies that value automatically.

The agent prepares two temporary JSON files, `plan.json` and `draft.json`, then runs:

```sh
node "<skill-dir>/scripts/build-report.js" \
  --plan plan.json --draft draft.json \
  --out "/absolute/path/<filename-from-handout>.docx" \
  --pdf "/absolute/path/<filename-from-handout>.pdf"
```

The script validates both files before opening WordCraft, stages the template and screenshots in a temporary folder, builds the DOCX, and optionally exports PDF. It refuses to overwrite an existing report. Missing screenshots or incomplete cover data stop a normal build. `allowDraft:true` produces a clearly labeled work copy with missing cover fields left blank instead. `--keep-temp` keeps the staging folder for debugging.

## Final audit

The build does not make the report true. After building, the agent compares the report with the source files, CSVs, terminal output, and previous-lab cover data:

- names, group, teacher, numbers, counts, and dates;
- direction of every inverted or normalized series;
- claims that the evidence does not support;
- captions that do not match the visible result;
- placeholders and invented data.

The agent renders the pages to local files and checks one contact sheet. Full-page images never enter the model context.

## Layout

```text
lab-report-utm/
├── SKILL.md                    Agent Skills instructions
├── references/workflow.md      plan/draft schema and audit rules
├── recipes/compose.js          WordCraft command sequence and checks
├── scripts/build-report.js     standalone build CLI
├── scripts/install.sh          Claude, Codex, and OpenCode installer
├── templates/                  WordCraft template
└── .opencode/commands/         OpenCode slash command
```

`Concluzii`, `Bibliografie`, and `Anexă` each start on a separate page. Each section flows if it is longer than a page. Omitted sections add no pages. The cover counts as page 1, but the first visible folio is 2.

## Fork status

This fork is tested end to end with OpenCode and DeepSeek High. Claude Code and Codex use the same Agent Skills layout, but their sessions were not run in this test.

Upstream does not declare a license. This repository does not grant rights to upstream material. Add a license only for content you own, and check that choice before publishing.

Keep reports, screenshots, student names, and local paths out of the repository.
