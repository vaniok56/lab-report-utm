#!/bin/sh
set -eu

here=$(cd "$(dirname "$0")/.." && pwd)
mode=${1:-all}
link=0
case "${2:-}" in
  --link) link=1 ;;
  "") ;;
  *) echo "usage: $0 [opencode|claude|codex|all] [--link]" >&2; exit 2 ;;
esac

copy_skill() {
  dest=$1
  if [ -e "$dest" ] || [ -L "$dest" ]; then
    echo "skip existing: $dest"
    return
  fi
  mkdir -p "$(dirname "$dest")"
  if [ "$link" = 1 ]; then
    mkdir -p "$dest"
    for item in SKILL.md README.md references recipes scripts templates; do
      ln -s "$here/$item" "$dest/$item"
    done
  else
    mkdir -p "$dest"
    (cd "$here" && tar -cf - --exclude .git --exclude .opencode \
      SKILL.md README.md references recipes scripts templates) | (cd "$dest" && tar -xf -)
  fi
  echo "installed: $dest"
}

install_opencode() {
  copy_skill "$HOME/.config/opencode/skills/lab-report-utm"
  command="$HOME/.config/opencode/commands/lab-report-utm.md"
  if [ -e "$command" ] || [ -L "$command" ]; then
    echo "skip existing: $command"
  else
    mkdir -p "$(dirname "$command")"
    if [ "$link" = 1 ]; then ln -s "$here/.opencode/commands/lab-report-utm.md" "$command"; else cp "$here/.opencode/commands/lab-report-utm.md" "$command"; fi
    echo "installed: $command"
  fi
}

case "$mode" in
  opencode) install_opencode ;;
  claude) copy_skill "$HOME/.claude/skills/lab-report-utm" ;;
  codex) copy_skill "$HOME/.agents/skills/lab-report-utm" ;;
  all)
    install_opencode
    copy_skill "$HOME/.claude/skills/lab-report-utm"
    copy_skill "$HOME/.agents/skills/lab-report-utm"
    ;;
  *) echo "usage: $0 [opencode|claude|codex|all] [--link]" >&2; exit 2 ;;
esac
