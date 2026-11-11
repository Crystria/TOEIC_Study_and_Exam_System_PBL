#!/usr/bin/env python3
"""Capture sanitized Backend entity IDs from a Postman environment export.

The input may contain credentials or bearer tokens. This program only reads an
explicit ID allow-list and never writes, prints or hashes secret values.
"""
from __future__ import annotations
import argparse, json, uuid
from datetime import datetime, timezone
from pathlib import Path

ID_KEYS = {
    'testIds': ('seedTestId', 'testId'),
    'topicIds': ('topicId',),
    'vocabularyIds': ('vocabularyId',),
    'lessonIds': ('lessonId',),
    'attemptIds': ('attemptId',),
    'questionIds': ('firstQuestionId',),
}

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('postman_environment_export', help='Exported Postman environment JSON. Do not commit this source export.')
    parser.add_argument('--output', default='test_data/backend_qa/live/api_id_registry.json')
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    src, output = Path(args.postman_environment_export), Path(args.output)
    if not src.is_file(): raise SystemExit(f'Environment export not found: {src}')
    try: data = json.loads(src.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError) as exc: raise SystemExit(f'Cannot parse Postman environment export: {exc}') from exc
    if not isinstance(data, dict) or not isinstance(data.get('values'), list):
        raise SystemExit('Expected a Postman environment export with a values[] list.')
    values = {x.get('key'): x.get('value') for x in data['values'] if isinstance(x, dict) and x.get('enabled', True)}
    entities = {}
    invalid = []
    for entity, names in ID_KEYS.items():
        collected = []
        for name in names:
            value = values.get(name)
            if value in (None, ''): continue
            try: canonical = str(uuid.UUID(str(value)))
            except (ValueError, TypeError, AttributeError):
                invalid.append(name)
                continue
            if canonical not in collected: collected.append(canonical)
        entities[entity] = collected
    if invalid: raise SystemExit('Invalid UUID in ID variables: ' + ', '.join(invalid))
    attempt_id = values.get('attemptId')
    submitted_attempt_id = values.get('submittedAttemptId')
    if values.get('qaReadyConfirmed') != 'true':
        raise SystemExit('QA preflight was not confirmed. Run the collection from the first request and verify /ready qa=true.')
    if not entities['testIds'] or not entities['attemptIds'] or not entities['questionIds']:
        raise SystemExit('Missing live IDs. Run the collection through Mock Test first.')
    if not attempt_id or submitted_attempt_id != attempt_id:
        raise SystemExit('The collection has not recorded a successful SUBMITTED attempt. Complete Submit FULL attempt before capturing IDs.')
    if output.exists() and not args.force: raise SystemExit(f'Output already exists: {output}. Use --force to replace it.')
    entities['groupIds'] = []
    safe = {
        'schemaVersion':'1.0.0',
        'status':'SANITIZED_POSTMAN_ID_CAPTURE',
        'capturedAt':datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'gatewayEnvironment':'isolated-local-qa',
        'idOriginPolicy':'Allow-listed UUIDs were populated from the isolated QA Gateway responses or the Backend QA seed registry.',
        'capturePolicy':'IDs only. This registry is not a substitute for the Postman Runner report or verified response evidence.',
        'entities':entities,
        'secretPolicy':'No email, password, access token, refresh token, cookie, authorization header, upload ticket, private media URL, source filename or raw response body is stored.',
        'liveBackendEvidence':False,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(safe, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(f'Wrote sanitized live ID registry: {output}')
    print('Only allow-listed UUID identifiers were retained; secret values were discarded.')
    return 0

if __name__ == '__main__': raise SystemExit(main())
