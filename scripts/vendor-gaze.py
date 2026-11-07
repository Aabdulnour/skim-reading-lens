#!/usr/bin/env python3
"""Restore or verify Skim's exact, locally served webcam dependencies.

Default use is offline verification. --fetch reconstructs the allowlisted tree
from integrity-checked upstream archives; it never runs npm or upstream code.
"""
from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import io
import json
import tarfile
import urllib.request
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "dist/vendor/webgazer-3.5.3"
VERSION = "3.5.3"
COMMIT = "b12701dd7b6d7b00d4b8dbebf87fdec840c24999"
TARBALL = "https://registry.npmjs.org/webgazer/-/webgazer-3.5.3.tgz"
INTEGRITY = "sha512-i6P97fWeixASmHWrJxgLUICugqV6qljIafi2ne6p0WYXAuldpwoaFRkedKFcu/qm95d128gdUxhOr336estXOw=="
TARBALL_SHA256 = "ddb577d3b971ce62018cce17e197546fcdc3db9eb51b57cf995b7ca777ca2443"
BUILD_FILES = {
    "package-lock.json": "909bd9afdd5ffd1d59837e742554db25be57bc0154adad0f2fb473cac9bb3aaf",
    "webpack.config.js": "9a705731d4342ed763e1f901953c77235372f57bd38d76afcd8a96c8f1053818",
}
MODEL_FILES = (
    "face_mesh.binarypb", "face_mesh.js", "face_mesh_solution_packed_assets.data",
    "face_mesh_solution_packed_assets_loader.js", "face_mesh_solution_simd_wasm_bin.data",
    "face_mesh_solution_simd_wasm_bin.js", "face_mesh_solution_simd_wasm_bin.wasm",
    "face_mesh_solution_wasm_bin.js", "face_mesh_solution_wasm_bin.wasm",
)
SOURCE_FILES = (
    "dom_util.mjs", "facemesh.mjs", "index.mjs", "mat.mjs", "params.mjs", "pupil.mjs",
    "ridgeReg.mjs", "ridgeRegThreaded.mjs", "ridgeWeightedReg.mjs", "ridgeWorker.mjs",
    "util.mjs", "util_regression.mjs", "worker_scripts/mat.js", "worker_scripts/util.js",
)
DEPENDENCY_LICENSES = {
    "localforage": "package/LICENSE",
    "regression": "package/LICENSE",
    "long": "package/LICENSE",
    "lie": "package/license.md",
    "immediate": "package/LICENSE.txt",
}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def download(url: str, *, cache: Path | None, name: str, sha256: str | None = None,
             integrity: str | None = None) -> bytes:
    saved = cache / name if cache else None
    if saved and saved.is_file():
        data = saved.read_bytes()
    else:
        with urllib.request.urlopen(url, timeout=45) as response:
            data = response.read()
    if sha256 and digest(data) != sha256:
        raise SystemExit(f"SHA-256 mismatch for {name}; no vendor files were written.")
    if integrity:
        algorithm, expected = integrity.split("-", 1)
        actual = base64.b64encode(hashlib.new(algorithm, data).digest()).decode()
        if actual != expected:
            raise SystemExit(f"Package integrity mismatch for {name}; no vendor files were written.")
    if saved and not saved.exists():
        saved.parent.mkdir(parents=True, exist_ok=True)
        saved.write_bytes(data)
    return data


def member(archive: tarfile.TarFile, name: str) -> bytes:
    # Read only named regular members. Never extract a downloaded tar tree.
    entry = archive.getmember(name)
    if not entry.isfile():
        raise SystemExit(f"Expected a regular archive file: {name}")
    with archive.extractfile(entry) as file:
        return file.read()


def restore(cache: Path | None) -> None:
    archive_bytes = download(TARBALL, cache=cache, name=f"webgazer-{VERSION}.tgz",
                             sha256=TARBALL_SHA256, integrity=INTEGRITY)
    files: dict[str, tuple[bytes, str]] = {}

    def add(path: str, data: bytes, role: str) -> None:
        files[path] = (data, role)

    with tarfile.open(fileobj=io.BytesIO(archive_bytes), mode="r:gz") as archive:
        add("webgazer.js", member(archive, "package/dist/webgazer.js"), "runtime")
        for filename in MODEL_FILES:
            path = "mediapipe/face_mesh/" + filename
            add(path, member(archive, "package/dist/" + path), "runtime")
        for filename in ("README.md", "package.json", "index.d.ts"):
            path = "mediapipe/face_mesh/" + filename
            add(path, member(archive, "package/dist/" + path), "source")
        for filename in SOURCE_FILES:
            add("source/src/" + filename, member(archive, "package/src/" + filename), "source")
        for filename in ("package.json", "LICENSE.md", "README.md"):
            add("source/" + filename, member(archive, "package/" + filename), "source")
        source_map = member(archive, "package/dist/webgazer.js.map")
        add("source/webgazer.js.map.gz", gzip.compress(source_map, compresslevel=9, mtime=0), "source")

    for filename, expected in BUILD_FILES.items():
        data = download(f"https://raw.githubusercontent.com/brownhci/WebGazer/{COMMIT}/{filename}",
                        cache=cache, name=filename, sha256=expected)
        add("source/" + filename, data, "source")

    lock = json.loads(files["source/package-lock.json"][0])
    for package, license_path in DEPENDENCY_LICENSES.items():
        info = lock["packages"]["node_modules/" + package]
        package_bytes = download(info["resolved"], cache=cache, name=package + ".tgz", integrity=info["integrity"])
        with tarfile.open(fileobj=io.BytesIO(package_bytes), mode="r:gz") as archive:
            add("licenses/" + package + ".txt", member(archive, license_path), "notice")

    # seedrandom preserves its complete license grant in source headers. Keep
    # those exact source files, including the bundled algorithm notices.
    seed = lock["packages"]["node_modules/seedrandom"]
    seed_bytes = download(seed["resolved"], cache=cache, name="seedrandom.tgz", integrity=seed["integrity"])
    with tarfile.open(fileobj=io.BytesIO(seed_bytes), mode="r:gz") as archive:
        for filename in ("seedrandom.js", "index.js", "lib/alea.js", "lib/tychei.js", "lib/xor128.js",
                         "lib/xor4096.js", "lib/xorshift7.js", "lib/xorwow.js"):
            add("source/seedrandom/" + filename, member(archive, "package/" + filename), "source")

    # The project's GPL text is the same version chosen for this distribution.
    gpl = (ROOT / "LICENSE").read_bytes()
    if digest(gpl) != "3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986":
        raise SystemExit("Review the project GPL text before changing the vendor license copy.")
    add("licenses/GPL-3.0.txt", gpl, "notice")

    package_names = (
        "@mediapipe/face_mesh", "@tensorflow-models/face-landmarks-detection",
        "@tensorflow/tfjs-core", "@tensorflow/tfjs-backend-cpu", "@tensorflow/tfjs-backend-webgl",
        "@tensorflow/tfjs-converter", "@tensorflow/tfjs-data", "@tensorflow/tfjs-layers",
        "localforage", "long", "regression", "seedrandom", "lie", "immediate",
    )
    packages = [{"name": name, "version": lock["packages"]["node_modules/" + name]["version"],
                 "license": lock["packages"]["node_modules/" + name].get("license", "See source notices")}
                for name in package_names]
    add("licenses/packages.json", (json.dumps(packages, indent=2) + "\n").encode(), "notice")
    add("README.md", (
        "# Pinned webcam dependencies\n\n"
        f"WebGazer {VERSION}, upstream commit {COMMIT}.\n\n"
        "These are unmodified upstream runtime files. Skim serves them from its own origin after explicit camera-setup consent "
        "or a deliberate compatibility check. The compatibility check does not open a camera. "
        "They are not included in the Chrome extension. See /docs/GAZE.md in the source repository.\n\n"
        "## Source and build inputs\n\n"
        "source/src contains the original WebGazer modules. source/package.json, source/package-lock.json and "
        "source/webpack.config.js preserve the matching upstream build configuration. "
        "source/webgazer.js.map.gz is the complete upstream source map, with all 1,229 embedded source entries. "
        "It is compressed to keep source downloads smaller; decompress with gzip -dk source/webgazer.js.map.gz. "
        "The unmodified runtime's sourceMappingURL points to webgazer.js.map; copy the decompressed map to that "
        "filename beside webgazer.js for browser debugging. The map is not needed to run the tracker.\n\n"
        "To rebuild upstream in an isolated temporary directory, copy source/package.json, source/package-lock.json, "
        "source/webpack.config.js and source/src there, copy mediapipe into src/mediapipe, then run npm ci and npm run build. "
        "The release restoration script uses the checksum-verified published package instead of claiming that another "
        "machine's rebuild is byte-identical. Upstream build dependencies are separate from Skim's zero-dependency runtime.\n\n"
        "## Licenses\n\n"
        "WebGazer: GPL-3.0-or-later, Copyright 2016-2026 Brown WebGazer Team. This project uses GPL version 3. "
        "The conditional LGPL option is not used. Original notice: source/LICENSE.md. Full GPL text: licenses/GPL-3.0.txt.\n\n"
        "MediaPipe, TensorFlow.js, face-landmarks-detection, localforage and long use Apache-2.0. "
        "licenses/long.txt contains the full Apache 2.0 text. Original source copyright notices are retained. "
        "regression, seedrandom, lie and immediate use MIT notices preserved in licenses/ and source/seedrandom/. "
        "licenses/packages.json records the selected dependency versions. The source map retains upstream notices.\n\n"
        "Restore exactly: python3 scripts/vendor-gaze.py --fetch. Verify without network: python3 scripts/vendor-gaze.py --verify. "
        "manifest.json records all shipped file sizes and SHA-256 digests.\n"
    ).encode(), "notice")

    # Assemble everything before writing. Invalid downloads leave the existing
    # release intact. Refuse unknown files rather than deleting user changes.
    expected = set(files) | {"manifest.json"}
    if DEST.exists():
        extras = {p.relative_to(DEST).as_posix() for p in DEST.rglob("*") if p.is_file()} - expected
        if extras:
            raise SystemExit("Unexpected vendor files; review before restoring: " + ", ".join(sorted(extras)))
    for path, (data, _) in sorted(files.items()):
        target = DEST / path
        if target.is_symlink() or any(parent.is_symlink() for parent in target.parents if parent != ROOT.parent):
            raise SystemExit(f"Refusing symlink in vendor path: {path}")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    manifest = {
        "schemaVersion": 1, "package": "webgazer", "version": VERSION,
        "upstream": {"tarball": TARBALL, "integrity": INTEGRITY, "sha256": TARBALL_SHA256, "gitCommit": COMMIT},
        "sourceMap": {"path": "source/webgazer.js.map.gz", "uncompressedBytes": len(source_map), "uncompressedSha256": digest(source_map)},
        "assets": [{"path": path, "bytes": len(data), "sha256": digest(data), "role": role}
                   for path, (data, role) in sorted(files.items())],
    }
    (DEST / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    verify()


def verify() -> None:
    manifest = json.loads((DEST / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("schemaVersion") != 1 or manifest.get("package") != "webgazer" or manifest.get("version") != VERSION:
        raise SystemExit("Unexpected vendor manifest version.")
    expected = {"manifest.json"}
    total = runtime = 0
    for asset in manifest["assets"]:
        name = asset["path"]
        path = PurePosixPath(name)
        if not name or path.is_absolute() or ".." in path.parts or "\\" in name or name in expected:
            raise SystemExit("Unsafe or duplicate vendor path.")
        expected.add(name)
        target = DEST / name
        if target.is_symlink() or not target.is_file():
            raise SystemExit("Missing or symlinked vendor asset: " + name)
        data = target.read_bytes()
        if len(data) != asset["bytes"] or digest(data) != asset["sha256"]:
            raise SystemExit("Vendor integrity check failed: " + name)
        total += len(data)
        if asset["role"] == "runtime":
            runtime += len(data)
    actual = {p.relative_to(DEST).as_posix() for p in DEST.rglob("*") if p.is_file()}
    if actual != expected or any(p.is_symlink() for p in DEST.rglob("*")):
        raise SystemExit("Vendor tree differs from its manifest.")
    source_map = gzip.decompress((DEST / manifest["sourceMap"]["path"]).read_bytes())
    if len(source_map) != manifest["sourceMap"]["uncompressedBytes"] or digest(source_map) != manifest["sourceMap"]["uncompressedSha256"]:
        raise SystemExit("Upstream source map integrity check failed.")
    print(f"Verified WebGazer {VERSION}: {len(expected)-1} files, {runtime:,} runtime bytes, {total:,} total bytes.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--fetch", action="store_true", help="restore exact assets from checksum-verified upstream downloads")
    mode.add_argument("--verify", action="store_true", help="verify existing files without network (default)")
    parser.add_argument("--cache-dir", type=Path, help="optional local archive cache, always integrity checked")
    args = parser.parse_args()
    if args.fetch:
        restore(args.cache_dir)
    else:
        verify()


if __name__ == "__main__":
    main()
