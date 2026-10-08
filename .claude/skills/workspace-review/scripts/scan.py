#!/usr/bin/env python3
"""Evidence scanner for /workspace-review.

Scans the workspace's files, recent Claude Code session transcripts and git
history, and prints a JSON report the skill turns into upgrade proposals.
Read-only: it never modifies anything.

Usage: python3 scan.py [--root .] [--days 7] [--min-repeat 3]
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

SKIP_DIRS = {".git", "node_modules", "dist", "build", ".next", ".venv", "venv",
             "__pycache__", ".cache", "_archive", "coverage", ".turbo"}
SKIP_FILES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml", ".DS_Store"}
DOC_EXTS = {".md", ".txt", ".doc", ".docx", ".pdf", ".csv", ".xlsx", ".pptx",
            ".png", ".jpg", ".jpeg", ".gif", ".svg"}
# Root-level files that belong at the top of a project.
ROOT_EXPECTED = re.compile(
    r"^(readme|license|changelog|contributing|claude|agents|status|"
    r"package\.json|tsconfig.*|\.?env\.example|\.gitignore|\.mcp\.json|"
    r"makefile|dockerfile|.*\.config\.[cm]?[jt]s|.*\.sh|pyproject\.toml|"
    r"requirements.*\.txt|cargo\.toml|go\.mod)",
    re.I,
)
VERSION_NOISE = re.compile(
    r"([\s_\-.]*(v\d+|final|copy|draft|new|old|latest|backup|bak|\(\d+\)|\d{4}-\d{2}-\d{2}))+$",
    re.I,
)


def norm_stem(name):
    stem, ext = os.path.splitext(name)
    s = stem.strip()
    prev = None
    while prev != s:
        prev = s
        s = VERSION_NOISE.sub("", s).strip(" _-.")
    return re.sub(r"[\s_\-]+", "-", s.lower()), ext.lower()


def scan_files(root):
    groups = defaultdict(list)
    lower = defaultdict(list)
    loose = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        rel_dir = os.path.relpath(dirpath, root)
        for fn in filenames:
            if fn in SKIP_FILES:
                continue
            rel = os.path.normpath(os.path.join(rel_dir, fn))
            key, ext = norm_stem(fn)
            if ext in DOC_EXTS and key:
                groups[(rel_dir, key, ext)].append(rel)
            lower[os.path.join(rel_dir, fn.lower())].append(rel)
            if rel_dir == "." and not ROOT_EXPECTED.match(fn) and not fn.startswith("."):
                loose.append(rel)

    def info(p):
        st = os.stat(os.path.join(root, p))
        return {"path": p, "modified": time.strftime("%Y-%m-%d", time.localtime(st.st_mtime)),
                "bytes": st.st_size}

    dupes = [sorted((info(p) for p in v), key=lambda x: x["path"])
             for v in groups.values() if len(v) > 1]
    collisions = [sorted(v) for v in lower.values() if len(v) > 1]
    return {"duplicate_groups": dupes, "case_collisions": collisions,
            "loose_root_files": sorted(loose)}


def transcript_dirs(root):
    base = Path(os.environ.get("CLAUDE_CONFIG_DIR", Path.home() / ".claude")) / "projects"
    if not base.is_dir():
        return []
    # Claude Code stores each project's sessions under its path with
    # non-alphanumerics replaced by "-".
    slug = re.sub(r"[^A-Za-z0-9]", "-", str(Path(root).resolve()))
    exact = base / slug
    return [exact] if exact.is_dir() else []


def text_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(c.get("text", "") for c in content
                         if isinstance(c, dict) and c.get("type") == "text")
    return ""


def norm_prompt(t):
    t = re.sub(r"\s+", " ", t.lower()).strip()
    t = re.sub(r"\d+", "#", t)
    return t[:160]


def scan_sessions(root, days, min_repeat):
    cutoff = time.time() - days * 86400
    files = [f for d in transcript_dirs(root) for f in d.glob("*.jsonl")
             if f.stat().st_mtime >= cutoff]
    prompts = defaultdict(set)      # normalized prompt -> session ids
    prompt_example = {}
    sentences = defaultdict(set)    # normalized sentence -> session ids
    sentence_example = {}
    commands = Counter()
    tools = Counter()
    for f in files:
        sid = f.stem
        try:
            lines = f.open(encoding="utf-8", errors="replace")
        except OSError:
            continue
        with lines:
            for line in lines:
                try:
                    d = json.loads(line)
                except ValueError:
                    continue
                if not isinstance(d, dict) or d.get("isMeta") or d.get("isSidechain"):
                    continue
                msg = d.get("message") or {}
                if d.get("type") == "user" and msg.get("role") == "user":
                    t = text_of(msg.get("content")).strip()
                    if not t or t.startswith("<") or len(t) < 12:
                        continue
                    k = norm_prompt(t)
                    prompts[k].add(sid)
                    prompt_example.setdefault(k, t[:200])
                    for s in re.split(r"(?<=[.!?])\s+|\n+", t):
                        s = s.strip()
                        if 25 <= len(s) <= 220:
                            ks = norm_prompt(s)
                            sentences[ks].add(sid)
                            sentence_example.setdefault(ks, s)
                elif d.get("type") == "assistant":
                    for c in msg.get("content") or []:
                        if isinstance(c, dict) and c.get("type") == "tool_use":
                            tools[c.get("name", "?")] += 1
                            cmd = (c.get("input") or {}).get("command")
                            if c.get("name") == "Bash" and isinstance(cmd, str):
                                commands[re.sub(r"\s+", " ", cmd.strip())[:160]] += 1

    def rep(d, ex):
        out = [{"example": ex[k], "sessions": len(v)} for k, v in d.items() if len(v) >= min_repeat]
        return sorted(out, key=lambda x: -x["sessions"])[:15]

    return {
        "sessions_scanned": len(files),
        "repeated_prompts": rep(prompts, prompt_example),
        "repeated_facts": [x for x in rep(sentences, sentence_example)
                           if x["example"] not in {p["example"] for p in rep(prompts, prompt_example)}][:15],
        "repeated_commands": [{"command": c, "count": n} for c, n in commands.most_common(15)
                              if n >= min_repeat],
        "tool_counts": dict(tools.most_common(20)),
    }


def scan_git(root, days):
    def git(*args):
        r = subprocess.run(["git", "-C", root, *args], capture_output=True, text=True)
        if r.returncode:
            raise RuntimeError(r.stderr.strip())
        return r.stdout

    try:
        since = f"--since={days} days ago"
        subjects = [s for s in git("log", since, "--pretty=%s").splitlines() if s]
        hot = Counter(p for p in git("log", since, "--name-only", "--pretty=").splitlines() if p)
        return {"commits": len(subjects), "recent_subjects": subjects[:20],
                "hot_files": [{"path": p, "commits": n} for p, n in hot.most_common(10)]}
    except (RuntimeError, FileNotFoundError) as e:
        return {"error": str(e) or "not a git repository"}


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--root", default=".")
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--min-repeat", type=int, default=3)
    a = ap.parse_args()
    root = os.path.abspath(a.root)
    report = {
        "root": root,
        "window_days": a.days,
        "files": scan_files(root),
        "sessions": scan_sessions(root, a.days, a.min_repeat),
        "git": scan_git(root, a.days),
    }
    json.dump(report, sys.stdout, indent=2)
    print()


if __name__ == "__main__":
    main()
