#!/usr/bin/env python3
"""Package Skim without dependencies, credentials, or machine-specific ZIP metadata."""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
OUT = DIST / "downloads"
EXTENSION = ROOT / "extension"
READER = EXTENSION / "reader"
BASE_URL = "https://skim-attention-lab-anthony.aabdulnour01.chatgpt.site"
ZIP_DATE = (2026, 1, 1, 0, 0, 0)

# Explicit runtime allowlist: test harnesses and release documentation do not ship
# as executable extension files. Add a new runtime file here when it is introduced.
RUNTIME_FILES = (
    "manifest.json", "popup.html", "popup.css", "popup.js", "settings.js",
    "service-worker.js", "auto.js", "overlay.js", "extract.js",
    "options.html", "options.css", "options.js",
    "welcome.html", "welcome.css", "welcome.js",
    "icons/icon16.png", "icons/icon32.png", "icons/icon48.png", "icons/icon128.png",
)
READER_FILES = ("index.html", "styles.css", "app.js", "core.js", "gaze.js", "icon.svg", "research.html")
ROOT_SOURCE_FILES = (
    "README.md", "LICENSE", "THIRD-PARTY-NOTICES.md", "package.json", "server.mjs",
    "CHANGELOG.md", "CONTRIBUTING.md", "SECURITY.md", "AGENTS.md", "CLAUDE.md", ".gitignore",
)
SOURCE_DIRECTORIES = ("dist", "extension", "scripts", "tests", "docs", "store-assets", ".github/ISSUE_TEMPLATE")
EXCLUDED_SOURCE_PARTS = frozenset({
    ".git", ".openai", "node_modules", "__pycache__", ".DS_Store", ".pytest_cache",
    ".venv", "venv", ".idea", ".vscode", "coverage", "playwright-report", "test-results",
    ".ssh", ".aws", ".kube", ".npmrc", ".pypirc", ".netrc", "id_rsa", "id_ed25519",
})
EXCLUDED_SOURCE_SUFFIXES = frozenset({".pyc", ".pyo", ".log", ".pem", ".key", ".p12", ".pfx"})


def archive(path: Path, entries: dict[str, bytes]) -> None:
    """Reproducible for the same source bytes and Python/zlib implementation."""
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as output:
        for name, data in sorted(entries.items()):
            info = zipfile.ZipInfo(name, date_time=ZIP_DATE)
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            output.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def checksums(entries: dict[str, bytes]) -> bytes:
    return "".join(f"{digest(data)}  {name}\n" for name, data in sorted(entries.items())).encode()


def source_path_allowed(relative: Path) -> bool:
    """Reject private machine state and recursive output within allowed roots."""
    parts = relative.parts
    if relative.is_absolute() or ".." in parts or "\\" in relative.as_posix():
        return False
    if parts[:2] == ("dist", "downloads"):
        return False
    if any(part in EXCLUDED_SOURCE_PARTS or part.startswith("__qa") for part in parts):
        return False
    if any(part.startswith(".env") for part in parts):
        return False
    return relative.suffix.lower() not in EXCLUDED_SOURCE_SUFFIXES


def prepare_reader() -> None:
    READER.mkdir(parents=True, exist_ok=True)
    # The product homepage is separate from the actual reading room.
    shutil.copyfile(DIST / "lab.html", READER / "index.html")
    for name in ("styles.css", "app.js", "core.js", "icon.svg", "research.html"):
        shutil.copyfile(DIST / name, READER / name)
    # The packaged extension executes only bundled code. The hosted webcam lab is
    # a separate page opened by a deliberate click and receives no imported text.
    (READER / "gaze.js").write_bytes((
        "(function(){'use strict';window.SkimGaze={create:function(options){return{"
        "start:async function(){options.onStatus?.({state:'unavailable',"
        "message:'This extension reader uses pointer and keyboard input. Open the web lab for experimental webcam gaze; your page text is not transferred.'});return false;},"
        "stop:function(){options.onStatus?.({state:'stopped',message:'Camera is off.'});}};}};})();\n"
    ).encode("utf-8"))
    for filename in ("index.html", "research.html"):
        path = READER / filename
        content = path.read_text(encoding="utf-8")
        for target in ("install.html", "privacy.html", "help.html", "lab.html", "downloads/skim-source.zip", "downloads/skim-extension.zip"):
            content = content.replace(f'href="{target}"', f'href="{BASE_URL}/{target}"')
        path.write_bytes(content.encode("utf-8"))


def source_paths() -> dict[str, Path]:
    """Return repository-relative source paths using the publication allowlist."""
    files = [ROOT / name for name in ROOT_SOURCE_FILES]
    for directory in SOURCE_DIRECTORIES:
        path = ROOT / directory
        if path.is_dir() and not path.is_symlink():
            files.extend(path.rglob("*"))
    result = {}
    for path in sorted(set(files)):
        if not path.is_file() or path.is_symlink():
            continue
        relative = path.relative_to(ROOT)
        if not source_path_allowed(relative):
            continue
        result[relative.as_posix()] = path
    return result


def source_entries() -> dict[str, bytes]:
    return {"skim/" + name: path.read_bytes() for name, path in source_paths().items()}


def main() -> None:
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    manifest = json.loads((EXTENSION / "manifest.json").read_text(encoding="utf-8"))
    version = package["version"]
    if version != manifest.get("version") or not re.fullmatch(r"\d+\.\d+\.\d+(?:\.\d+)?", version):
        raise SystemExit("Package and extension versions must match before packaging.")
    OUT.mkdir(parents=True, exist_ok=True)
    prepare_reader()
    runtime = {name: (EXTENSION / name).read_bytes() for name in RUNTIME_FILES}
    runtime.update({"reader/" + name: (READER / name).read_bytes() for name in READER_FILES})
    for name in ("LICENSE", "THIRD-PARTY-NOTICES.md"):
        runtime[name] = (ROOT / name).read_bytes()

    store_name = f"skim-chrome-store-v{version}.zip"
    store_path = OUT / store_name
    archive(store_path, runtime)
    tester = {"skim-extension/" + name: data for name, data in runtime.items()}
    tester["skim-extension/README.md"] = (EXTENSION / "README.md").read_bytes()
    archive(OUT / "skim-extension.zip", tester)
    archive(OUT / "skim-source.zip", source_entries())

    kit = {
        "store/" + store_name: store_path.read_bytes(),
        "source/skim-source.zip": (OUT / "skim-source.zip").read_bytes(),
        "README.txt": (
            f"Skim Reading Lens {version} release kit\n\n"
            "Upload only the ZIP in store/ to the Chrome Web Store. Its manifest.json is at the ZIP root.\n"
            "The source/ ZIP is the complete open-source project; it is not a store upload.\n"
            "Read docs/RELEASE.md for the remaining publisher steps and docs/STORE-LISTING.md for prepared fields.\n"
            "This packet is not a Chrome Web Store approval or a signed macOS application.\n"
        ).encode(),
    }
    for name in ("docs/RELEASE.md", "docs/STORE-LISTING.md", "CHANGELOG.md", "SECURITY.md", "LICENSE"):
        kit[name] = (ROOT / name).read_bytes()
    assets = ROOT / "store-assets"
    if assets.exists():
        for path in sorted(assets.rglob("*")):
            if path.is_file() and not path.is_symlink() and path.suffix.lower() in {".png", ".jpg", ".jpeg", ".md"}:
                kit["store-assets/" + path.relative_to(assets).as_posix()] = path.read_bytes()
    kit["SHA256SUMS"] = checksums(kit)
    kit_name = f"skim-release-kit-v{version}.zip"
    archive(OUT / kit_name, kit)
    # The list itself is deliberately excluded from its own digest.
    artifacts = {name: (OUT / name).read_bytes() for name in (store_name, "skim-extension.zip", "skim-source.zip", kit_name)}
    (OUT / "SHA256SUMS").write_bytes(checksums(artifacts))
    for name, data in artifacts.items():
        print(f"{name}: {len(data):,} bytes | SHA-256 {digest(data)}")


if __name__ == "__main__":
    main()
