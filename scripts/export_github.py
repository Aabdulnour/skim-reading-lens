#!/usr/bin/env python3
"""Describe the sanitized source for GitHub publication without account access.

Run with no arguments for a deterministic metadata manifest. Use --file PATH to
emit one GitHub blob payload, or --file PATH --metadata-only to inspect one file.
For a large file, --chunk-bytes 49152 --offset 0 emits one base64 content chunk.
Follow nextOffset until done; chunk sizes and offsets must be multiples of three
so the ordered base64 content strings can be concatenated for create_blob.
PATH is relative to the public repository, for example dist/core.js. This helper
uses the exact source ZIP allowlist and never reads Git history or hosting state.
It does not create a repository, upload files, or authenticate to a service.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import sys

sys.dont_write_bytecode = True
import package as packaging


def blob_sha(data: bytes) -> str:
    """Git's SHA-1 object identity, distinct from the release SHA-256 digest."""
    return hashlib.sha1(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()


def entry(path: str, data: bytes, include_content: bool = False) -> dict:
    try:
        content = data.decode("utf-8")
        encoding = "utf-8"
    except UnicodeDecodeError:
        content = None
        encoding = "base64"
    result = {
        "path": path,
        "mode": "100644",
        "type": "blob",
        "bytes": len(data),
        "sha256": packaging.digest(data),
        "gitBlobSha": blob_sha(data),
        "encoding": encoding,
    }
    if include_content:
        result["content"] = content if content is not None else base64.b64encode(data).decode("ascii")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", help="Emit only this allowlisted repository-relative file; no arbitrary paths are accepted.")
    parser.add_argument("--metadata-only", action="store_true", help="With --file, omit its content.")
    parser.add_argument("--chunk-bytes", type=int, help="With --file, emit up to this many bytes as base64; must be a positive multiple of 3, at most 196608.")
    parser.add_argument("--offset", type=int, default=0, help="Byte offset for a chunk; must be a nonnegative multiple of 3.")
    args = parser.parse_args()
    sources = packaging.source_paths()
    if args.chunk_bytes is not None and (not args.file or args.metadata_only or args.chunk_bytes <= 0 or args.chunk_bytes > 196608 or args.chunk_bytes % 3 or args.offset < 0 or args.offset % 3):
        parser.error("Chunks require --file, no --metadata-only, a positive size divisible by 3 up to 196608, and an offset divisible by 3.")
    if args.offset and args.chunk_bytes is None:
        parser.error("--offset requires --chunk-bytes.")
    if args.file:
        if args.file not in sources:
            parser.error("The requested path is absent from the sanitized source export.")
        path = sources[args.file]
        if args.chunk_bytes is not None:
            total = path.stat().st_size
            if args.offset > total:
                parser.error("The requested chunk offset is beyond this file.")
            with path.open("rb") as stream:
                stream.seek(args.offset)
                data = stream.read(args.chunk_bytes)
            end = args.offset + len(data)
            result = {
                "path": args.file,
                "encoding": "base64",
                "offset": args.offset,
                "bytes": len(data),
                "totalBytes": total,
                "nextOffset": end,
                "done": end == total,
                "content": base64.b64encode(data).decode("ascii"),
            }
        else:
            result = entry(args.file, path.read_bytes(), not args.metadata_only)
    else:
        version = json.loads((packaging.ROOT / "package.json").read_text(encoding="utf-8"))["version"]
        files = [entry(name, path.read_bytes()) for name, path in sorted(sources.items())]
        result = {
            "schemaVersion": 1,
            "version": version,
            "fileCount": len(files),
            "totalBytes": sum(file["bytes"] for file in files),
            "files": files,
        }
    print(json.dumps(result, ensure_ascii=True, sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError) as error:
        print(f"Unable to export source: {error}", file=sys.stderr)
        sys.exit(1)
