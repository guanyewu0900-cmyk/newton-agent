#!/usr/bin/env python3
"""
One-command Git push helper for this project.

Usage:
  python push_to_git.py
  python push_to_git.py -m "Update website text"
  python push_to_git.py --remote-url https://github.com/USER/REPO.git
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def run(args: list[str], *, check: bool = True, capture: bool = False) -> subprocess.CompletedProcess[str]:
    print("+ " + " ".join(args))
    return subprocess.run(
        args,
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=capture,
        check=check,
    )


def output(args: list[str]) -> str:
    return run(args, capture=True).stdout.strip()


def ensure_git_repo() -> None:
    git_dir = ROOT / ".git"
    if not git_dir.exists():
        run(["git", "init"])
        run(["git", "branch", "-M", "main"])


def ensure_safe_directory() -> None:
    run(["git", "config", "--global", "--add", "safe.directory", str(ROOT).replace("\\", "/")], check=False)


def ensure_remote(remote_url: str | None) -> None:
    remotes = output(["git", "remote"])
    has_origin = "origin" in remotes.splitlines()
    if has_origin:
        current = output(["git", "remote", "get-url", "origin"])
        print(f"origin: {current}")
        return
    if not remote_url:
        raise SystemExit(
            "No git remote named 'origin'. Run again with:\n"
            "  python push_to_git.py --remote-url https://github.com/YOUR_NAME/newton-agent.git"
        )
    run(["git", "remote", "add", "origin", remote_url])


def current_branch() -> str:
    branch = output(["git", "branch", "--show-current"])
    if branch:
        return branch
    run(["git", "branch", "-M", "main"])
    return "main"


def has_changes() -> bool:
    return bool(output(["git", "status", "--porcelain"]))


def commit_changes(message: str) -> None:
    run(["git", "add", "-A"])
    if not output(["git", "diff", "--cached", "--name-only"]):
        print("No staged changes to commit.")
        return
    run(["git", "commit", "-m", message])


def push(branch: str) -> None:
    run(["git", "push", "-u", "origin", branch])


def main() -> int:
    parser = argparse.ArgumentParser(description="Commit local changes and push this project to GitHub.")
    parser.add_argument("-m", "--message", default="Update website", help="Commit message to use when changes exist.")
    parser.add_argument("--remote-url", help="Remote GitHub repository URL to add if origin does not exist.")
    parser.add_argument("--skip-commit", action="store_true", help="Push only; do not add or commit local changes.")
    args = parser.parse_args()

    try:
        ensure_git_repo()
        ensure_safe_directory()
        ensure_remote(args.remote_url)
        branch = current_branch()
        print(f"branch: {branch}")

        if not args.skip_commit:
            if has_changes():
                commit_changes(args.message)
            else:
                print("Working tree is clean. Nothing to commit.")

        push(branch)
        print("Done. Your latest code has been pushed.")
        return 0
    except subprocess.CalledProcessError as exc:
        if exc.stdout:
            print(exc.stdout)
        if exc.stderr:
            print(exc.stderr, file=sys.stderr)
        print("\nGit command failed. If this is a GitHub connection error, try again after changing networks or proxy settings.", file=sys.stderr)
        return exc.returncode or 1


if __name__ == "__main__":
    raise SystemExit(main())
