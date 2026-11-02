"""Extract direct Word evidence without modifying the originals."""
import json
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[2]
out = root / "tmp/frontend-integration-session32"
out.mkdir(parents=True, exist_ok=True)
keywords = ["FK-", "presign", "content_markdown", "INACTIVE", "SUSPENDED", "FULL_TEST", "MINI_TEST", "1000", "20 lượt", "5 MB", "2 MB", "kích hoạt", "SM-2", "avatar", "0.5", "30 ngày", "nhắc"]
ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
evidence = {}
for file in (root / "docs").glob("*.docx"):
    with ZipFile(file) as archive:
        doc = ET.fromstring(archive.read("word/document.xml"))
    paragraphs = ["".join(p.itertext()) for p in doc.findall(".//w:p", ns)]
    hits = set()
    for i, text in enumerate(paragraphs):
        if any(k.casefold() in text.casefold() for k in keywords):
            hits.update(range(max(0, i - 1), min(len(paragraphs), i + 3)))
    evidence[file.name] = [{"paragraph": i, "text": paragraphs[i]} for i in sorted(hits)]
(out / "word-evidence.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")
for name, rows in evidence.items():
    print(name, len(rows), "evidence paragraphs")
    for row in rows:
        if any(k.casefold() in row["text"].casefold() for k in keywords[1:]):
            print(str(row["paragraph"]) + ": " + row["text"][:700])
