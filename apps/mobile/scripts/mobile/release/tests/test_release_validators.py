from __future__ import annotations
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[4]
ARCHITECTURE_SCRIPT = PROJECT_ROOT / "scripts/mobile/architecture/validate_feature_boundaries.py"
sys.path.insert(0, str(SCRIPT_DIR))
import validate_release_inputs  # noqa: E402


class ArchitectureBoundaryValidatorTests(unittest.TestCase):
    def test_current_feature_boundaries_are_clean(self) -> None:
        result = subprocess.run(
            [sys.executable, str(ARCHITECTURE_SCRIPT), "--project-root", str(PROJECT_ROOT)],
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_screen_export_of_repository_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            project = Path(directory)
            screen = project / "lib/features/mock_test/screens/preview.dart"
            repository = project / "lib/features/mock_test/repositories/repository.dart"
            screen.parent.mkdir(parents=True)
            repository.parent.mkdir(parents=True)
            screen.write_text("export '../repositories/repository.dart';\n", encoding="utf-8")
            repository.write_text("class Repository {}\n", encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(ARCHITECTURE_SCRIPT), "--project-root", str(project)],
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("repositories", result.stdout)


class ReleaseInputValidatorTests(unittest.TestCase):
    def test_current_production_entry_graph_isolated(self) -> None:
        errors = validate_release_inputs.scan_graph(
            PROJECT_ROOT,
            PROJECT_ROOT / "lib/main_release.dart",
        )[1]
        self.assertEqual(errors, [])

    def test_export_and_part_directives_are_included_in_graph(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            project = Path(directory)
            (project / "lib").mkdir()
            (project / "lib/main_release.dart").write_text(
                "export 'release_exports.dart';\n", encoding="utf-8"
            )
            (project / "lib/release_exports.dart").write_text(
                "part 'release_part.dart';\n", encoding="utf-8"
            )
            (project / "lib/release_part.dart").write_text(
                "class ReleasePart {}\n", encoding="utf-8"
            )
            visited, errors = validate_release_inputs.scan_graph(
                project, project / "lib/main_release.dart"
            )
            self.assertEqual(errors, [])
            self.assertEqual(len(visited), 3)

    def test_export_of_test_data_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            project = Path(directory)
            (project / "lib").mkdir()
            forbidden = project / "lib/data_sources/test_data/fixture.dart"
            forbidden.parent.mkdir(parents=True)
            forbidden.write_text("class FixtureAdapter {}\n", encoding="utf-8")
            (project / "lib/main_release.dart").write_text(
                "export 'data_sources/test_data/fixture.dart';\n", encoding="utf-8"
            )
            _, errors = validate_release_inputs.scan_graph(
                project, project / "lib/main_release.dart"
            )
            self.assertTrue(any("Forbidden Test Data path" in e for e in errors))


class ReleaseArtifactValidatorTests(unittest.TestCase):
    def _run_validator(self, artifact: Path) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(SCRIPT_DIR / "validate_release_artifact.py"), str(artifact)],
            text=True,
            capture_output=True,
            check=False,
        )

    def test_clean_artifact_is_accepted(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory) / "clean.apk"
            with zipfile.ZipFile(artifact, "w") as archive:
                archive.writestr("assets/flutter_assets/AssetManifest.bin", b"clean-manifest")
            result = self._run_validator(artifact)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_fixture_asset_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory) / "dirty.apk"
            with zipfile.ZipFile(artifact, "w") as archive:
                archive.writestr("assets/flutter_assets/AssetManifest.bin", b"manifest")
                archive.writestr("assets/flutter_assets/test_data/example.json", b"{}")
            result = self._run_validator(artifact)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Test Data", result.stdout)

    def test_known_test_repository_marker_in_aot_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory) / "dirty.apk"
            with zipfile.ZipFile(artifact, "w") as archive:
                archive.writestr("assets/flutter_assets/AssetManifest.bin", b"manifest")
                archive.writestr("lib/arm64-v8a/libapp.so", b"TestDataMockTestMapper")
            result = self._run_validator(artifact)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("TestDataMockTestMapper", result.stdout)

    def test_test_data_repository_marker_in_aot_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory) / "dirty-auth.apk"
            with zipfile.ZipFile(artifact, "w") as archive:
                archive.writestr("assets/flutter_assets/AssetManifest.bin", b"manifest")
                archive.writestr("lib/arm64-v8a/libapp.so", b"TestDataAuthRepository")
            result = self._run_validator(artifact)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("TestDataAuthRepository", result.stdout)


if __name__ == "__main__":
    unittest.main()
