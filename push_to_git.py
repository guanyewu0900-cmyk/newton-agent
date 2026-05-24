import pathlib
import subprocess
import sys


def main() -> int:
    root = pathlib.Path(__file__).resolve().parent
    script = root / "sync-github.ps1"

    command = [
        "powershell",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(script),
        *sys.argv[1:],
    ]

    result = subprocess.run(command, cwd=root)
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
