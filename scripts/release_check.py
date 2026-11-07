#!/usr/bin/env python3
"""Check release artifacts. Passing is packaging evidence, not store approval."""
from __future__ import annotations

import argparse
import hashlib
import json
import posixpath
import re
import struct
import sys
import zipfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

sys.dont_write_bytecode = True
import package as packaging

ROOT = packaging.ROOT
OUT = packaging.OUT
FAILURES: list[str] = []
MAX_EXTENSION_BYTES = 8 * 1024 * 1024  # Project budget, not a Web Store maximum.
MAX_ARCHIVE_BYTES = 64 * 1024 * 1024
VENDOR_DIRECTORY = "vendor/webgazer-3.5.3"
GAZE_RUNTIME_ASSETS = (
    "webgazer.js",
    "mediapipe/face_mesh/face_mesh.binarypb",
    "mediapipe/face_mesh/face_mesh_solution_packed_assets.data",
    "mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.data",
    "mediapipe/face_mesh/face_mesh_solution_packed_assets_loader.js",
    "mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.js",
    "mediapipe/face_mesh/face_mesh_solution_wasm_bin.js",
    "mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.wasm",
    "mediapipe/face_mesh/face_mesh_solution_wasm_bin.wasm",
    "mediapipe/face_mesh/face_mesh.js",
)
GAZE_SOURCE_ASSETS = (
    "README.md", "source/README.md", "source/LICENSE.md", "source/package.json",
    "source/package-lock.json", "source/webpack.config.js", "source/src/index.mjs",
    "source/webgazer.js.map.gz", "licenses/GPL-3.0.txt", "licenses/packages.json",
)


def check(condition: bool, message: str) -> bool:
    if not condition:
        FAILURES.append(message)
        print("FAIL " + message)
    return condition


def png_dimensions(data: bytes) -> tuple[int, int] | None:
    if len(data) < 26 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", data[16:24])


def read_zip(path: Path, limit: int = MAX_ARCHIVE_BYTES) -> dict[str, bytes]:
    if not check(path.is_file(), f"Missing artifact: {path.name}"):
        return {}
    if not check(path.stat().st_size <= limit, f"Artifact exceeds project size budget: {path.name}"):
        return {}
    try:
        with zipfile.ZipFile(path) as archive:
            infos = archive.infolist()
            names = [item.filename for item in infos]
            check(len(names) == len(set(names)), f"Duplicate ZIP members: {path.name}")
            if not check(sum(item.file_size for item in infos) <= MAX_ARCHIVE_BYTES, f"Uncompressed artifact exceeds project size budget: {path.name}"):
                return {}
            result = {}
            for info in infos:
                parts = Path(info.filename).parts
                if not check(not info.filename.startswith(("/", "\\")) and ".." not in parts and "\\" not in info.filename, f"Unsafe ZIP member: {info.filename}"):
                    continue
                check(info.date_time == packaging.ZIP_DATE, f"Non-reproducible ZIP timestamp: {info.filename}")
                check(info.create_system == 3 and (info.external_attr >> 16) == 0o100644, f"Unexpected ZIP file metadata: {info.filename}")
                result[info.filename] = archive.read(info)
            return result
    except (zipfile.BadZipFile, RuntimeError) as error:
        check(False, f"Unreadable ZIP {path.name}: {error}")
        return {}


def verify_checksums(data: bytes, entries: dict[str, bytes], label: str) -> None:
    try:
        lines = data.decode("utf-8").splitlines()
        actual = {}
        for line in lines:
            value, name = line.split("  ", 1)
            actual[name] = value
        check(set(actual) == set(entries), f"Incomplete checksum list: {label}")
        for name, content in entries.items():
            check(actual.get(name) == hashlib.sha256(content).hexdigest(), f"Checksum mismatch: {label}/{name}")
    except (ValueError, UnicodeDecodeError):
        check(False, f"Malformed checksum list: {label}")


class ResourceParser(HTMLParser):
    def __init__(self, filename: str, entries: dict[str, bytes]):
        super().__init__()
        self.filename = filename
        self.entries = entries
        self.inline_script = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        check(not any(name.lower().startswith("on") for name, _ in attrs), f"Inline event handler in {self.filename}")
        if tag == "script":
            src = values.get("src")
            self.inline_script = not src and values.get("type") not in {"application/json", "application/ld+json"}
            if src:
                parsed = urlsplit(src)
                check(not parsed.scheme and not parsed.netloc and not src.startswith("/"), f"Non-local executable script in {self.filename}")
                location = posixpath.normpath(posixpath.join(posixpath.dirname(self.filename), parsed.path))
                check(location in self.entries, f"Missing script dependency {location} from {self.filename}")
        if tag == "link" and values.get("rel") == "stylesheet":
            href = values.get("href", "") or ""
            parsed = urlsplit(href)
            check(not parsed.scheme and not parsed.netloc, f"Non-local stylesheet in {self.filename}")
            location = posixpath.normpath(posixpath.join(posixpath.dirname(self.filename), parsed.path))
            check(location in self.entries, f"Missing stylesheet dependency {location} from {self.filename}")

    def handle_data(self, data: str) -> None:
        if self.inline_script and data.strip():
            check(False, f"Inline executable script violates extension CSP in {self.filename}")

    def handle_endtag(self, tag: str) -> None:
        if tag == "script":
            self.inline_script = False


def check_web_resource(filename: str, reference: str, kind: str, must_be_local: bool = False) -> None:
    """Check published HTML/CSS resources without making network requests."""
    parsed = urlsplit(reference)
    external = bool(parsed.scheme or parsed.netloc)
    if must_be_local:
        check(not external, f"Non-local website {kind} in {filename}: {reference}")
    if external or not parsed.path:
        return
    decoded = unquote(parsed.path)
    if decoded.startswith("/"):
        location = posixpath.normpath(decoded.lstrip("/"))
    else:
        location = posixpath.normpath(posixpath.join(posixpath.dirname(filename), decoded))
    if not check(location != ".." and not location.startswith("../") and "\\" not in location, f"Website resource escapes dist/: {filename} -> {reference}"):
        return
    path = ROOT / "dist" / location
    if path.is_dir():
        path = path / "index.html"
    elif not path.suffix and not path.is_file():
        path = path.with_suffix(".html")
    check(path.is_file() and not path.is_symlink(), f"Missing website {kind}: {filename} -> {reference}")


class WebResourceParser(HTMLParser):
    def __init__(self, filename: str):
        super().__init__()
        self.filename = filename

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "script" and values.get("src"):
            check_web_resource(self.filename, values["src"], "script", must_be_local=True)
        elif tag == "link" and values.get("href"):
            check_web_resource(self.filename, values["href"], "link", must_be_local=values.get("rel") == "stylesheet")
        elif tag == "a" and values.get("href"):
            check_web_resource(self.filename, values["href"], "link")
        elif tag in {"img", "iframe", "audio", "video", "source"} and values.get("src"):
            check_web_resource(self.filename, values["src"], "asset")


def verify_vendor_assets() -> None:
    directory = ROOT / "dist" / VENDOR_DIRECTORY
    manifest_path = directory / "manifest.json"
    if not check(manifest_path.is_file(), "Missing pinned gaze dependency manifest"):
        return
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    check(manifest.get("schemaVersion") == 1, "Unsupported gaze dependency manifest schema")
    check(manifest.get("package") == "webgazer" and manifest.get("version") == "3.5.3", "Unexpected pinned WebGazer package or version")
    upstream = manifest.get("upstream", {})
    if not check(isinstance(upstream, dict), "Malformed upstream gaze dependency metadata"):
        return
    check(upstream.get("tarball") == "https://registry.npmjs.org/webgazer/-/webgazer-3.5.3.tgz", "Unexpected upstream gaze dependency URL")
    check(bool(re.fullmatch(r"[a-f0-9]{64}", upstream.get("sha256", ""))), "Missing upstream gaze dependency SHA-256")
    check(bool(re.fullmatch(r"[a-f0-9]{40}", upstream.get("gitCommit", ""))), "Missing upstream gaze source commit")
    assets = manifest.get("assets", [])
    if not check(isinstance(assets, list) and bool(assets), "Empty gaze asset manifest"):
        return
    seen = set()
    total = 0
    for asset in assets:
        if not check(isinstance(asset, dict) and isinstance(asset.get("path"), str), "Malformed gaze asset entry"):
            continue
        name = asset["path"]
        parts = Path(name).parts
        if not check(bool(parts) and not name.startswith("/") and "\\" not in name and ".." not in parts and posixpath.normpath(name) == name, f"Unsafe gaze asset path: {name}"):
            continue
        check(name not in seen and name != "manifest.json", f"Duplicate or self-referencing gaze asset: {name}")
        seen.add(name)
        path = directory / name
        if not check(path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(directory.resolve()), f"Missing or unsafe pinned gaze asset: {name}"):
            continue
        data = path.read_bytes()
        total += len(data)
        check(asset.get("bytes") == len(data), f"Pinned gaze asset size differs: {name}")
        check(asset.get("sha256") == hashlib.sha256(data).hexdigest(), f"Pinned gaze asset checksum differs: {name}")
    actual = {path.relative_to(directory).as_posix() for path in directory.rglob("*") if path.is_file() and path != manifest_path}
    check(actual == seen, "Gaze dependency directory contains unlisted or missing files")
    check(set(GAZE_RUNTIME_ASSETS).issubset(seen), "The pinned gaze bundle is missing a runtime model or loader asset")
    check(set(GAZE_SOURCE_ASSETS).issubset(seen), "The pinned gaze bundle must include its source, build inputs, and license notices")
    check(total <= MAX_ARCHIVE_BYTES, "Pinned gaze source/runtime exceeds the 64 MiB project budget")
    gaze_source = (ROOT / "dist/gaze.js").read_text(encoding="utf-8")
    check(VENDOR_DIRECTORY in gaze_source, "Gaze loader does not reference the pinned local dependency")
    check("mediapipe/face_mesh" in gaze_source and "faceMeshSolutionPath" in gaze_source, "Gaze loader must explicitly configure its local face model directory")
    check("https://webgazer.cs.brown.edu/webgazer.js" not in gaze_source, "Gaze loader still references the unpinned remote runtime")
    print(f"Checked {len(seen)} pinned gaze dependency files, hashes, and local model configuration.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--submission", action="store_true", help="Also require a configured publisher support contact. Legal/account/store review steps remain manual.")
    args = parser.parse_args()
    manifest = json.loads((ROOT / "extension/manifest.json").read_text())
    package = json.loads((ROOT / "package.json").read_text())
    version = package["version"]
    config_path = ROOT / "dist/release-config.js"
    release_config = config_path.read_text(encoding="utf-8") if config_path.is_file() else ""
    config_version = re.search(r"\bversion\s*:\s*['\"]([^'\"]+)['\"]", release_config)
    check(bool(config_version) and config_version[1] == version, "Website and package release versions differ")
    check(manifest.get("version") == version, "Package and extension version differ")
    check(manifest.get("manifest_version") == 3, "Extension must use Manifest V3")
    check(len(manifest.get("description", "")) <= 132, "Manifest description exceeds 132 characters")
    check(set(manifest.get("permissions", [])) == {"activeTab", "scripting", "storage"}, "Unexpected installation permissions")
    check(not manifest.get("host_permissions"), "Permanent host permissions must not be required at installation")
    check(set(manifest.get("optional_host_permissions", [])) == {"http://*/*", "https://*/*"}, "Optional host patterns must support only HTTP and HTTPS sites")
    check(not manifest.get("content_scripts"), "Automatic injection must be registered only for opted-in sites")
    check(manifest.get("content_security_policy", {}).get("extension_pages") == "script-src 'self'; object-src 'none'", "Unexpected extension CSP")
    for size in (16, 32, 48, 128):
        location = manifest.get("icons", {}).get(str(size))
        path = ROOT / "extension" / str(location)
        if check(bool(location) and path.is_file(), f"Missing extension icon {size}"):
            check(png_dimensions(path.read_bytes()) == (size, size), f"Wrong extension icon dimensions: {path.name}")
    print("Checked version, least-privilege manifest, CSP, and extension icons.")

    store_name = f"skim-chrome-store-v{version}.zip"
    kit_name = f"skim-release-kit-v{version}.zip"
    store = read_zip(OUT / store_name, MAX_EXTENSION_BYTES)
    check("manifest.json" in store, "Chrome Web Store ZIP must have manifest.json at its root")
    expected = {name: (ROOT / "extension" / name).read_bytes() for name in packaging.RUNTIME_FILES if (ROOT / "extension" / name).is_file()}
    expected.update({"reader/" + name: (ROOT / "extension/reader" / name).read_bytes() for name in packaging.READER_FILES if (ROOT / "extension/reader" / name).is_file()})
    expected.update({name: (ROOT / name).read_bytes() for name in ("LICENSE", "THIRD-PARTY-NOTICES.md")})
    check(len(expected) == len(packaging.RUNTIME_FILES) + len(packaging.READER_FILES) + 2, "A runtime allowlisted file is missing")
    check(store == expected, "Store ZIP differs from the current runtime files; rebuild it")
    for name, data in store.items():
        if name.endswith(".html"):
            ResourceParser(name, store).feed(data.decode("utf-8"))
        if name.endswith(".js"):
            source = data.decode("utf-8")
            check(not re.search(r"\b(?:eval|Function|XMLHttpRequest|WebSocket)\s*\(", source), f"Dynamic code or unexpected networking primitive in {name}")
            for match in re.finditer(r"\bimportScripts\s*\(([^)]*)\)", source):
                arguments = match.group(1)
                imports = re.findall(r"['\"]([^'\"]+)['\"]", arguments)
                check(bool(imports) and not re.sub(r"['\"][^'\"]+['\"]|[\s,]", "", arguments), f"Non-literal importScripts in {name}")
                for target in imports:
                    parsed = urlsplit(target)
                    location = posixpath.normpath(posixpath.join(posixpath.dirname(name), parsed.path))
                    check(not parsed.scheme and not parsed.netloc and location in store, f"Non-local or missing importScripts dependency {target} in {name}")
            check(not re.search(r"\bgetUserMedia\s*\(", source), f"Camera runtime accidentally included in extension: {name}")
            check(not re.search(r"(?:import\s*\(|\bfrom\s*)['\"]https?://", source), f"Remote module in {name}")
            check(not re.search(r"\b(?:REPLACE_ME|YOUR_API_KEY|YOUR_EXTENSION_ID|CHANGEME)\b", source), f"Unresolved executable placeholder in {name}")
    check(b"webgazer.js" not in store.get("reader/gaze.js", b""), "Hosted webcam loader must not ship in extension")
    print("Checked exact store contents, local executable dependencies, and camera isolation.")

    tester = read_zip(OUT / "skim-extension.zip", MAX_EXTENSION_BYTES)
    tester_expected = {"skim-extension/" + name: data for name, data in expected.items()}
    tester_expected["skim-extension/README.md"] = (ROOT / "extension/README.md").read_bytes()
    check(tester == tester_expected, "Tester ZIP differs from the current runtime files; rebuild it")
    source = read_zip(OUT / "skim-source.zip")
    check(source == packaging.source_entries(), "Source ZIP differs from current publishable source; rebuild it")
    required_source = {
        "skim/LICENSE", "skim/server.mjs", "skim/scripts/package.py", "skim/scripts/export_github.py",
        "skim/AGENTS.md", "skim/CLAUDE.md", "skim/docs/GAZE.md",
    }
    check(required_source.issubset(source), "Source bundle is missing required contributor, gaze, or build files")
    for name in source:
        check(name.startswith("skim/") and packaging.source_path_allowed(Path(name.removeprefix("skim/"))), f"Private/generated state in source bundle: {name}")
    print("Checked tester/source parity and exclusion of credentials, private hosting state, and nested downloads.")

    verify_vendor_assets()
    for path in sorted((ROOT / "dist").glob("*.html")):
        if not path.name.startswith("__qa"):
            WebResourceParser(path.name).feed(path.read_text(encoding="utf-8"))
    for path in sorted((ROOT / "dist").glob("*.css")):
        for match in re.finditer(r"url\(\s*(['\"]?)(.*?)\1\s*\)", path.read_text(encoding="utf-8")):
            check_web_resource(path.name, match[2], "CSS asset")
    print("Checked public website links, scripts, styles, and local assets.")

    image_files = list((ROOT / "store-assets").glob("*.png"))
    dimensions = {path.name: png_dimensions(path.read_bytes()) for path in image_files}
    screenshots = [name for name, size in dimensions.items() if size == (1280, 800)]
    check(1 <= len(screenshots) <= 5, "Provide between one and five 1280x800 store screenshots")
    check((128, 128) in dimensions.values(), "Provide a 128x128 store icon in store-assets/")
    for name, size in dimensions.items():
        check(size in {(128, 128), (1280, 800), (440, 280), (1400, 560)}, f"Unexpected store image dimensions: {name} {size}")
    for filename in ("privacy.html", "help.html", "install.html", "index.html", "lab.html"):
        check((ROOT / "dist" / filename).is_file(), f"Missing public release page: {filename}")
    print("Checked required listing assets and release pages.")

    kit = read_zip(OUT / kit_name)
    check(kit.get("store/" + store_name) == (OUT / store_name).read_bytes() if (OUT / store_name).exists() else False, "Release kit store artifact is stale")
    check(kit.get("source/skim-source.zip") == (OUT / "skim-source.zip").read_bytes() if (OUT / "skim-source.zip").exists() else False, "Release kit source artifact is stale")
    for path in ("docs/RELEASE.md", "docs/STORE-LISTING.md", "CHANGELOG.md", "SECURITY.md", "LICENSE"):
        check(kit.get(path) == (ROOT / path).read_bytes(), f"Release kit document is stale: {path}")
    for path in image_files:
        check(kit.get("store-assets/" + path.name) == path.read_bytes(), f"Release kit image is stale: {path.name}")
    verify_checksums(kit.get("SHA256SUMS", b""), {name: value for name, value in kit.items() if name != "SHA256SUMS"}, "release kit")
    artifacts = {name: (OUT / name).read_bytes() for name in (store_name, "skim-extension.zip", "skim-source.zip", kit_name) if (OUT / name).is_file()}
    checksum_path = OUT / "SHA256SUMS"
    verify_checksums(checksum_path.read_bytes() if checksum_path.exists() else b"", artifacts, "downloads")
    print("Checked release packet freshness and SHA-256 checksums.")

    if args.submission:
        check(bool(re.search(r"supportEmail\s*:\s*['\"][^'\"\s]+@[^'\"\s]+\.[^'\"\s]+['\"]", release_config)), "Configure a public support contact before submission; verify it separately in Google's dashboard")
    if FAILURES:
        print(f"\nRelease checks failed: {len(FAILURES)} issue(s).")
        return 1
    print(f"\nPASS Skim {version} release artifact checks.")
    print("This checks the packaged files. It does not establish a real Chrome installation, human gaze accuracy, Chrome Web Store approval, or publisher legal attestations.")
    if not args.submission:
        print("Before submitting: run npm run release:check -- --submission and complete docs/RELEASE.md. Email verification and legal/account steps are separate from this file check.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError) as error:
        print(f"FAIL Unable to inspect release: {error}")
        sys.exit(1)
