from __future__ import annotations
import json
import subprocess
import sys
import tempfile
import unittest
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
SCRIPT = HERE / 'capture_phase_p_api_ids.py'


def environment(*, submitted: bool = True) -> dict:
    values = {
        'seedTestId': str(uuid.uuid4()),
        'testId': str(uuid.uuid4()),
        'topicId': str(uuid.uuid4()),
        'vocabularyId': str(uuid.uuid4()),
        'lessonId': str(uuid.uuid4()),
        'attemptId': str(uuid.uuid4()),
        'firstQuestionId': str(uuid.uuid4()),
        'qaUserAEmail': 'private-user@example.invalid',
        'qaUserAPassword': 'DO_NOT_PERSIST_PASSWORD',
        'accessTokenA': 'DO_NOT_PERSIST_ACCESS_TOKEN',
        'refreshTokenA': 'DO_NOT_PERSIST_REFRESH_TOKEN',
    }
    values['submittedAttemptId'] = values['attemptId'] if submitted else ''
    values['qaReadyConfirmed'] = 'true'
    return {'name': 'local QA', 'values': [
        {'key': key, 'value': value, 'enabled': True}
        for key, value in values.items()
    ]}


class CapturePhasePIdsTests(unittest.TestCase):
    def test_capture_requires_completed_attempt_and_discards_secrets(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / 'environment-export.json'
            output = root / 'api_id_registry.json'
            source.write_text(json.dumps(environment()), encoding='utf-8')
            result = subprocess.run(
                [sys.executable, str(SCRIPT), str(source), '--output', str(output)],
                capture_output=True, text=True, check=False,
            )
            self.assertEqual(0, result.returncode, result.stderr or result.stdout)
            captured = output.read_text(encoding='utf-8')
            registry = json.loads(captured)
            self.assertEqual('SANITIZED_POSTMAN_ID_CAPTURE', registry['status'])
            self.assertEqual('isolated-local-qa', registry['gatewayEnvironment'])
            self.assertFalse(registry['liveBackendEvidence'])
            self.assertIn('groupIds', registry['entities'])
            self.assertTrue(registry['entities']['attemptIds'])
            for secret in (
                'private-user@example.invalid',
                'DO_NOT_PERSIST_PASSWORD',
                'DO_NOT_PERSIST_ACCESS_TOKEN',
                'DO_NOT_PERSIST_REFRESH_TOKEN',
            ):
                self.assertNotIn(secret, captured)

    def test_capture_rejects_attempt_without_successful_submit_marker(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / 'environment-export.json'
            output = root / 'api_id_registry.json'
            source.write_text(json.dumps(environment(submitted=False)), encoding='utf-8')
            result = subprocess.run(
                [sys.executable, str(SCRIPT), str(source), '--output', str(output)],
                capture_output=True, text=True, check=False,
            )
            self.assertNotEqual(0, result.returncode)
            self.assertIn('successful SUBMITTED attempt', result.stderr + result.stdout)
            self.assertFalse(output.exists())


    def test_capture_rejects_environment_without_qa_preflight_marker(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / 'environment-export.json'
            output = root / 'api_id_registry.json'
            data = environment()
            next(x for x in data['values'] if x['key'] == 'qaReadyConfirmed')['value'] = ''
            source.write_text(json.dumps(data), encoding='utf-8')
            result = subprocess.run(
                [sys.executable, str(SCRIPT), str(source), '--output', str(output)],
                capture_output=True, text=True, check=False,
            )
            self.assertNotEqual(0, result.returncode)
            self.assertIn('QA preflight was not confirmed', result.stderr + result.stdout)
            self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main()
