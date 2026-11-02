"""Offline Windows speech -> staged MP3. Never edits frontend or publishes files."""

import argparse
import hashlib
import json
import math
import shutil
import struct
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
MAX_BYTES = 5_000_000  # conservative interpretation of the documented 5 MB


def run(args):
    return subprocess.run(
        [str(a) for a in args], check=True, capture_output=True,
        encoding="utf-8", errors="replace", timeout=300,
    ).stdout


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_content(content):
    if content["schemaVersion"] != 1 or len(content["clips"]) != 28:
        raise ValueError("Expected 24 vocabulary clips and four Listening templates")
    ids, urls = set(), set()
    for clip in content["clips"]:
        if clip["id"] in ids or clip["publicUrl"] in urls:
            raise ValueError("Duplicate clip ID or URL")
        ids.add(clip["id"])
        urls.add(clip["publicUrl"])
        if not clip["id"].isascii() or any(c not in "abcdefghijklmnopqrstuvwxyz0123456789-" for c in clip["id"]):
            raise ValueError("Unsafe clip ID")
        if clip["publicUrl"] != f'/demo/audio/{clip["id"]}.mp3':
            raise ValueError("Unexpected target URL")
        if not clip["segments"] or any(not s["text"].strip() or s["speaker"] not in ("primary", "second") for s in clip["segments"]):
            raise ValueError("Empty text or invalid speaker")
        if not clip["fixtureIds"]:
            raise ValueError("Missing fixture mapping")
    for relative, expected in content["sourceSha256"].items():
        source = (ROOT / relative).resolve()
        if not source.is_relative_to(ROOT) or digest(source) != expected:
            raise ValueError(f"Source changed: {relative}; review transcripts/mapping before generating")


def validate_mp3(path, ffmpeg, ffprobe):
    size = path.stat().st_size
    if not 0 < size <= MAX_BYTES:
        raise ValueError(f"Invalid MP3 size: {path}")
    info = json.loads(run([ffprobe, "-v", "error", "-show_streams", "-show_format", "-of", "json", path]))
    streams = info["streams"]
    duration = float(info["format"]["duration"])
    if len(streams) != 1 or streams[0]["codec_name"] != "mp3" or not math.isfinite(duration) or not 0.3 < duration < 180:
        raise ValueError(f"Invalid MP3 codec/duration: {path}")
    # Fully decode; reject silence, NaN and damaged input. This is not a speech/ASR check.
    decoded = subprocess.run(
        [str(ffmpeg), "-v", "error", "-xerror", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", "16000", "pipe:1"],
        check=True, capture_output=True, timeout=60,
    ).stdout
    samples = [s[0] for s in struct.iter_unpack("<f", decoded)]
    if not samples or not all(math.isfinite(s) for s in samples):
        raise ValueError(f"Invalid decoded samples: {path}")
    rms = math.sqrt(sum(s * s for s in samples) / len(samples))
    if rms < 0.001:
        raise ValueError(f"Silent/near-silent output: {path}")
    return {"bytes": size, "durationSeconds": duration, "sha256": digest(path), "decodedRms": rms, "codec": "mp3"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-content", action="store_true", help="Validate transcript/mapping/source hashes only; no synthesis")
    parser.add_argument("--check-only", action="store_true", help="List enabled voices and check encoder; no synthesis")
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--ffprobe", default="ffprobe")
    parser.add_argument("--encoder", choices=("libmp3lame", "mp3_mf"), default="libmp3lame")
    parser.add_argument("--voice", default="Microsoft David Desktop")
    parser.add_argument("--second-voice", default="Microsoft Zira Desktop")
    args = parser.parse_args()
    content_path = HERE / "content.json"
    content = json.loads(content_path.read_text(encoding="utf-8"))
    validate_content(content)
    if args.check_content:
        print("PASS: 28 planned clips, unique mappings/paths, source hashes unchanged. No audio generated.")
        return
    ffmpeg, ffprobe = shutil.which(args.ffmpeg), shutil.which(args.ffprobe)
    if not ffmpeg or not ffprobe:
        raise ValueError("Install FFmpeg + FFprobe or provide absolute --ffmpeg/--ffprobe paths")
    version = run([ffmpeg, "-version"]).splitlines()[0]
    probe_version = run([ffprobe, "-version"]).splitlines()[0]
    encoders = run([ffmpeg, "-hide_banner", "-encoders"])
    if args.encoder not in encoders:
        raise ValueError(f"Encoder unavailable: {args.encoder}")
    command = ["powershell.exe", "-NoProfile", "-NonInteractive", "-File", HERE / "speak.ps1", "-Content", content_path,
               "-Voice", args.voice, "-SecondVoice", args.second_voice]
    # Do not bypass execution policy or retry access denied with another API/account.
    if args.check_only:
        print(run(command + ["-OutputDirectory", HERE, "-CheckOnly"]))
        print(version, probe_version, "Encoder:", args.encoder, sep="\n")
        print("Preflight only; synthesis and playback have NOT been verified.")
        return
    staging_root = ROOT / "tmp"
    staging_root.mkdir(exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix="demo-audio-generated-", dir=staging_root))
    print(f"Staging: {staging}", flush=True)
    print(run(command + ["-OutputDirectory", staging]))
    records = []
    for clip in content["clips"]:
        wav, mp3 = staging / f'{clip["id"]}.wav', staging / f'{clip["id"]}.mp3'
        run([ffmpeg, "-nostdin", "-hide_banner", "-v", "error", "-xerror", "-n", "-i", wav,
             "-map_metadata", "-1", "-ac", "1", "-ar", "44100", "-c:a", args.encoder, "-b:a", "96k", mp3])
        records.append({"id": clip["id"], "publicUrl": clip["publicUrl"], "fixtureIds": clip["fixtureIds"],
                        **validate_mp3(mp3, ffmpeg, ffprobe)})
    manifest = {"schemaVersion": 1, "generatedAt": datetime.now(timezone.utc).isoformat(),
                "synthetic": True, "officialETS": False, "tool": "Windows System.Speech (.NET Framework)",
                "voice": args.voice, "secondVoice": args.second_voice, "speechRate": -1, "volume": 100,
                "segmentPauseMs": 550, "encoder": args.encoder, "ffmpeg": version, "ffprobe": probe_version,
                "voiceInformation": json.loads((staging / "voice-info.json").read_text(encoding="utf-8-sig")),
                "transcriptSha256": digest(content_path), "sourceSha256": content["sourceSha256"],
                "physicalListeningVerified": False, "browserPlaybackVerified": False, "files": records}
    (staging / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Generated and decoded {len(records)} MP3s. Not published: {staging}")
    print("Listen against content.json, then integrate and perform browser playback QA. No completion claim.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError, subprocess.SubprocessError) as error:
        print(f"FAILED: {error}", file=sys.stderr)
        if isinstance(error, subprocess.CalledProcessError):
            print(error.stderr, file=sys.stderr)
        sys.exit(1)
