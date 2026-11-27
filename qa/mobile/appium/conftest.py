from __future__ import annotations
import re

import os
from pathlib import Path

import pytest
from appium import webdriver
from appium.options.android import UiAutomator2Options
from dotenv import load_dotenv

from support.api_helper import QAApiClient

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")


def pytest_addoption(parser):
    parser.addoption("--run-cases", action="store", default="", help="Comma-separated IDs, e.g. MOB-001,MOB-009")


def pytest_collection_modifyitems(config, items):
    requested = {x.strip().upper() for x in (config.getoption("--run-cases") or os.getenv("RUN_CASES", "")).split(",") if x.strip()}
    if not requested:
        return
    for item in items:
        match = re.search(r"mob[_-](\d{3})", item.name, flags=re.IGNORECASE)
        case_id = ("MOB-" + match.group(1)) if match else None
        if case_id not in requested:
            item.add_marker(pytest.mark.skip(reason="Not selected by RUN_CASES/--run-cases."))


@pytest.fixture(scope="session")
def qa_api():
    if os.getenv("APP_API_ENABLED", "false").lower() != "true":
        pytest.skip("APP_API_ENABLED is not true; mock/demo run is not valid evidence for live API QA.")
    client = QAApiClient()
    try:
        client.require_qa()
    except Exception as exc:
        pytest.skip(f"QA Gateway preflight blocked: {exc}")
    return client


@pytest.fixture
def driver(request):
    if os.getenv("APP_API_ENABLED", "false").lower() != "true":
        pytest.skip("This test pack is for the real API APK, not FakeAuth/mock mode.")
    app_path = Path(os.getenv("APP_PATH", "")).expanduser()
    if not app_path.is_file():
        pytest.skip(f"APP_PATH does not point to an existing APK: {app_path}")
    appium_url = os.getenv("APPIUM_SERVER_URL","http://127.0.0.1:4723").rstrip("/")
    options = UiAutomator2Options()
    options.platform_name = "Android"
    options.automation_name = "UiAutomator2"
    options.device_name = os.getenv("DEVICE_NAME", "Android Emulator")
    udid = os.getenv("DEVICE_UDID", "").strip()
    if udid:
        options.udid = udid
    platform_version = os.getenv("PLATFORM_VERSION", "").strip()
    if platform_version:
        options.platform_version = platform_version
    options.app = str(app_path.resolve())
    options.no_reset = os.getenv("APPIUM_NO_RESET", "false").lower() == "true"
    options.new_command_timeout = int(os.getenv("NEW_COMMAND_TIMEOUT", "300"))
    options.auto_grant_permissions = True
    options.set_capability("appWaitDuration", 30000)
    options.set_capability("uiautomator2ServerLaunchTimeout", 60000)

    session = webdriver.Remote(appium_url, options=options)
    session.implicitly_wait(1)
    request.node._appium_driver = session
    yield session
    try:
        session.quit()
    except Exception:
        pass


@pytest.fixture
def qa_user_a():
    return {
        "email": os.getenv("QA_EMAIL", ""),
        "password": os.getenv("QA_PASSWORD", ""),
    }


@pytest.fixture
def qa_user_b():
    return {
        "email": os.getenv("QA_USER_B_EMAIL", ""),
        "password": os.getenv("QA_USER_B_PASSWORD", ""),
    }


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    if report.when == "call" and report.failed:
        driver = getattr(item, "_appium_driver", None)
        if driver:
            artifact_dir = Path(os.getenv("ARTIFACT_DIR", "artifacts"))
            artifact_dir.mkdir(parents=True, exist_ok=True)
            safe_name = item.name.replace("/", "_")
            try:
                driver.save_screenshot(str(artifact_dir / f"{safe_name}.png"))
                (artifact_dir / f"{safe_name}.xml").write_text(driver.page_source, encoding="utf-8")
            except Exception:
                pass
