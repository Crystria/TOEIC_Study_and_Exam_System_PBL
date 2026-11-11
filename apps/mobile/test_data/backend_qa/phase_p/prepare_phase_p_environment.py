#!/usr/bin/env python3
"""Create a local Postman environment using only the sanitized Phase N seed ID registry.

No account fields, emails, passwords, access/refresh tokens or raw seed data are read.
"""
from __future__ import annotations
import argparse, json, uuid
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--registry', default='test_data/backend_qa/live/seed_id_registry.json')
    parser.add_argument('--template', default='test_data/backend_qa/phase_p/TOEIC_Phase_P_QA.postman_environment.template.json')
    parser.add_argument('--output', default='test_data/backend_qa/phase_p/local/TOEIC_Phase_P_QA.postman_environment.json')
    parser.add_argument('--force', action='store_true', help='Replace an existing local environment file.')
    args = parser.parse_args()
    registry_path, template_path, output_path = map(Path, (args.registry, args.template, args.output))
    if not registry_path.is_file():
        raise SystemExit(f'Live seed registry not found: {registry_path}. Run Phase N capture_backend_qa_seed_id.py first.')
    if not template_path.is_file():
        raise SystemExit(f'Postman environment template not found: {template_path}')
    try:
        registry = json.loads(registry_path.read_text(encoding='utf-8'))
        template = json.loads(template_path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f'Cannot parse registry/template JSON: {exc}') from exc
    if registry.get('status') != 'CAPTURED_FROM_BACKEND_QA_SEED':
        raise SystemExit('Registry status is not CAPTURED_FROM_BACKEND_QA_SEED.')
    try:
        test_id = str(uuid.UUID(str(registry.get('testId'))))
    except (ValueError, TypeError, AttributeError) as exc:
        raise SystemExit('Registry testId is missing or invalid.') from exc
    count = registry.get('seededAccountCount')
    if not isinstance(count, int) or count < 2:
        raise SystemExit('The QA seed must contain at least two accounts for ownership tests.')
    if output_path.exists() and not args.force:
        raise SystemExit(f'Output already exists: {output_path}. Use --force to replace it.')
    found = False
    for row in template.get('values', []):
        if row.get('key') == 'seedTestId':
            row['value'] = test_id
            found = True
        elif row.get('key') == 'seededAccountCount':
            row['value'] = str(count)
    if not found:
        raise SystemExit('Template is missing the seedTestId variable.')
    template['name'] = 'TOEIC Mobile - Phase P QA (local credentials required)'
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(template, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Created local Postman environment: {output_path}')
    print('Only the sanitized testId and account count were imported. Enter both QA emails/passwords inside Postman.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
