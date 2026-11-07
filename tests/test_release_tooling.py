"""Release boundary regressions. Run: python3 -m unittest discover -s tests -p 'test_release_tooling.py'."""
from __future__ import annotations

import base64
import contextlib
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

sys.dont_write_bytecode = True
PROJECT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT / "scripts"))
import export_github
import package as packaging
import release_check


class ReleaseBoundaryTests(unittest.TestCase):
    def test_source_export_omits_private_state_and_nested_artifacts(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            include = {"README.md", "AGENTS.md", "CLAUDE.md", "dist/app.js", "docs/GAZE.md"}
            exclude = {
                ".openai/hosting.json", ".git/config", ".env", "dist/.env.local",
                "dist/downloads/skim-source.zip", "dist/__qa-fixture.html",
                "scripts/__pycache__/module.pyc", "scripts/certificate.PEM", "scripts/private.key",
                "tests/.git/config", "tests/test-results/run.json", "scripts/.npmrc", "scripts/id_ed25519", "unrelated-private-notes.txt",
            }
            for name in include | exclude:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(name.encode())
            (root / "dist/linked-secret.txt").symlink_to(root / "unrelated-private-notes.txt")
            with patch.object(packaging, "ROOT", root):
                paths = packaging.source_paths()
                self.assertEqual(set(paths), include)
                self.assertEqual(set(packaging.source_entries()), {"skim/" + name for name in include})

    def test_archive_bytes_are_reproducible_and_have_fixed_metadata(self):
        with tempfile.TemporaryDirectory() as folder:
            first, second = Path(folder) / "first.zip", Path(folder) / "second.zip"
            entries = {"nested/binary.bin": b"\x00\xff\x01", "README.md": b"Public source\n"}
            packaging.archive(first, entries)
            packaging.archive(second, dict(reversed(list(entries.items()))))
            self.assertEqual(first.read_bytes(), second.read_bytes())
            with zipfile.ZipFile(first) as archive:
                self.assertEqual({name: archive.read(name) for name in archive.namelist()}, entries)
                for info in archive.infolist():
                    self.assertEqual(info.date_time, packaging.ZIP_DATE)
                    self.assertEqual(info.external_attr >> 16, 0o100644)

    def test_github_chunks_reconstruct_binary_and_refuse_private_paths(self):
        name = "extension/icons/icon16.png"
        expected = (PROJECT / name).read_bytes()
        encoded, offset = [], 0
        while True:
            result = subprocess.run(
                [sys.executable, str(PROJECT / "scripts/export_github.py"), "--file", name,
                 "--chunk-bytes", "99", "--offset", str(offset)],
                check=True, capture_output=True, text=True,
            )
            chunk = json.loads(result.stdout)
            self.assertEqual(chunk["offset"], offset)
            encoded.append(chunk["content"])
            offset = chunk["nextOffset"]
            if chunk["done"]:
                break
        actual = base64.b64decode("".join(encoded), validate=True)
        self.assertEqual(actual, expected)
        self.assertEqual(export_github.entry(name, actual)["gitBlobSha"],
                         hashlib.sha1(b"blob " + str(len(actual)).encode() + b"\0" + actual).hexdigest())
        for name in (".openai/hosting.json", "../package.json", str(PROJECT / "package.json")):
            result = subprocess.run(
                [sys.executable, str(PROJECT / "scripts/export_github.py"), "--file", name],
                capture_output=True, text=True,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(result.stdout, "")


class DependencyChecksTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = Path(self.folder.name)
        self.directory = self.root / "dist" / release_check.VENDOR_DIRECTORY
        self.directory.mkdir(parents=True)
        assets = []
        for name in release_check.GAZE_RUNTIME_ASSETS + release_check.GAZE_SOURCE_ASSETS:
            data = ("Fixture for " + name).encode()
            path = self.directory / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            assets.append({"path": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "role": "runtime"})
        (self.directory / "manifest.json").write_text(json.dumps({
            "schemaVersion": 1, "package": "webgazer", "version": "3.5.3",
            "upstream": {"tarball": "https://registry.npmjs.org/webgazer/-/webgazer-3.5.3.tgz", "sha256": "a" * 64, "gitCommit": "b" * 40},
            "assets": assets,
        }))
        (self.root / "dist/gaze.js").write_text(
            "const base = 'vendor/webgazer-3.5.3'; const faceMeshSolutionPath = 'mediapipe/face_mesh';"
        )
        self.original_failures = release_check.FAILURES
        release_check.FAILURES = []
        self.root_patch = patch.object(release_check, "ROOT", self.root)
        self.root_patch.start()

    def tearDown(self):
        self.root_patch.stop()
        release_check.FAILURES = self.original_failures
        self.folder.cleanup()

    def verify(self):
        with contextlib.redirect_stdout(io.StringIO()):
            release_check.verify_vendor_assets()

    def test_missing_model_asset_fails_release(self):
        self.verify()
        self.assertEqual(release_check.FAILURES, [])
        (self.directory / "mediapipe/face_mesh/face_mesh.binarypb").unlink()
        self.verify()
        self.assertTrue(any("Missing or unsafe pinned gaze asset" in failure for failure in release_check.FAILURES))

    def test_changed_dependency_and_unlisted_file_fail_release(self):
        (self.directory / "webgazer.js").write_text("Unexpected upstream update")
        (self.directory / "untracked.js").write_text("Unlisted executable")
        self.verify()
        self.assertTrue(any("checksum differs" in failure for failure in release_check.FAILURES))
        self.assertTrue(any("unlisted or missing" in failure for failure in release_check.FAILURES))

    def test_missing_website_script_fails_release(self):
        with contextlib.redirect_stdout(io.StringIO()):
            release_check.WebResourceParser("index.html").feed('<script src="missing.js"></script>')
        self.assertTrue(any("Missing website script" in failure for failure in release_check.FAILURES))


if __name__ == "__main__":
    unittest.main()
