"""Read-only source processing. OCR output is never marked editorially approved."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path
from pypdf import PdfReader


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', default='docs/TEST 1')
    parser.add_argument('--out', required=True)
    parser.add_argument('--solutions', action='store_true')
    args = parser.parse_args()
    source, out = Path(args.source).resolve(), Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    records = []
    for pdf in sorted(source.glob('*.pdf')):
        prefix = pdf.name[:3].replace('.', '')
        if not args.solutions and prefix not in ['11', '12']:
            continue
        folder = out / prefix
        folder.mkdir(exist_ok=True)
        source_hash = hashlib.sha256(pdf.read_bytes()).hexdigest()
        marker = folder / 'source.sha256'
        if marker.exists() and marker.read_text(encoding='ascii').strip() != source_hash:
            raise ValueError(f'Source PDF changed: {pdf.name}; use a new evidence directory')
        marker.write_text(source_hash + '\n', encoding='ascii')
        reader = PdfReader(pdf)
        records.append(dict(file=str(pdf.relative_to(Path.cwd())), sha256=hashlib.sha256(pdf.read_bytes()).hexdigest(), pages=len(reader.pages), textChars=sum(len(p.extract_text()) for p in reader.pages)))
        for i in range(len(reader.pages)):
            target = folder / f'page-{i+1:03d}'
            if not target.with_suffix('.png').exists():
                subprocess.run(['pdftoppm', '-f', str(i+1), '-l', str(i+1), '-singlefile', '-scale-to', '2500', '-png', str(pdf), str(target)], check=True, capture_output=True)
        subprocess.run(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(Path(__file__).with_name('ocr-test1.ps1')), '-ImageDirectory', str(folder)], check=True)
    (out / 'pdf-inventory.json').write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding='utf-8')


if __name__ == '__main__':
    main()
