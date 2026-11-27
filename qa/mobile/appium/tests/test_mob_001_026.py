from __future__ import annotations

import os
import re
import subprocess
import time
from pathlib import Path

import pytest
from appium.webdriver.common.appiumby import AppiumBy

from support.api_helper import QAApiClient, find_question_ids, find_value, walk
from support.ui_helper import (
    active_attempt_from_history, answer_state, candidates, edit_fields, has_text,
    label, login_if_needed, logout_if_possible, open_full_test, select_answer,
    start_full_test, tap_any, tap_submit, tap_text, wait_text,
)
from selenium.webdriver.support.ui import WebDriverWait


def _truthy(name: str) -> bool:
    return os.getenv(name, "false").strip().lower() in {"1", "true", "yes"}


def _credential(name: str) -> str:
    return os.getenv(name, "").strip()


def _prepare(driver, api: QAApiClient, *, user_b: bool = False):
    api.require_qa()
    email = _credential("QA_USER_B_EMAIL") if user_b else _credential("QA_EMAIL")
    password = _credential("QA_USER_B_PASSWORD") if user_b else _credential("QA_PASSWORD")
    if not email or not password:
        pytest.skip("Thiếu credentials QA cục bộ trong appium/.env.")
    api.login(email, password, os.getenv("DEVICE_ID", "appium-qa") + ("-b" if user_b else "-a"))
    login_if_needed(driver, email, password)
    return api


def _home(driver):
    exam_tab = label("UI_EXAM_TAB", "Kiểm tra")
    for _ in range(6):
        if has_text(driver, exam_tab):
            return
        try:
            driver.back()
            time.sleep(0.5)
        except Exception:
            break
    if not has_text(driver, exam_tab):
        # Do not guess at navigation when the current full-screen flow is unknown.
        raise AssertionError("Cannot return to the main navigation (expected exam tab).")


def _attempt(api: QAApiClient) -> tuple[str, dict]:
    history = api.history(page=1, size=50)
    candidates_in_history = []
    for item in walk(history):
        status = str(item.get("status") or item.get("state") or "").upper()
        attempt_id = item.get("attemptId") or item.get("id")
        if attempt_id and status in {"IN_PROGRESS", "ACTIVE"}:
            stamp = str(item.get("startedAt") or item.get("createdAt") or item.get("created_at") or "")
            candidates_in_history.append((stamp, str(attempt_id)))
    if not candidates_in_history:
        raise AssertionError("No active attempt found in the authenticated user's API history.")
    # History is normally newest-first; use the timestamp when present.
    candidates_in_history.sort(key=lambda row: row[0], reverse=True)
    attempt_id = candidates_in_history[0][1]
    return attempt_id, api.get_attempt(attempt_id)


def _countdown_text(driver) -> str:
    source = driver.page_source
    patterns = [r"\b\d{1,2}:\d{2}:\d{2}\b", r"\b\d{1,2}:\d{2}\b"]
    for pattern in patterns:
        match = re.search(pattern, source)
        if match:
            return match.group(0)
    return ""


def _seconds(text: str) -> int | None:
    try:
        parts = [int(x) for x in text.split(":")]
        if len(parts) == 3:
            return parts[0] * 3600 + parts[1] * 60 + parts[2]
        if len(parts) == 2:
            return parts[0] * 60 + parts[1]
    except Exception:
        return None
    return None


def _assert_no_pre_submit_key(payload: dict):
    blocked = {"correctOption", "answerKey", "explanation", "transcript"}
    leaked = [key for obj in walk(payload) for key in obj.keys() if key in blocked]
    assert not leaked, f"Pre-submit API response leaked protected fields: {sorted(set(leaked))}"


def _adb(udid: str, *args: str):
    command = ["adb"]
    if udid:
        command += ["-s", udid]
    command += list(args)
    return subprocess.run(command, capture_output=True, text=True, check=True, timeout=20)


def _need_package():
    package = _credential("APP_PACKAGE")
    if not package:
        pytest.skip("Cần APP_PACKAGE trong .env cho terminate/activate/clear app.")
    return package


def _try_review(driver):
    tap_any(driver, [label("UI_REVIEW", "Xem lại đáp án"), "Xem đáp án", "Lời giải"], timeout=8)


def test_mob_001_install_launch_and_qa_connection(driver, qa_api):
    """MOB-001: install/launch APK and verify a real QA connection."""
    readiness = qa_api.require_qa()
    assert readiness.get("status") == "ready" and readiness.get("qa") is True
    title = label("UI_APP_TITLE", "TOEIC Master")
    assert has_text(driver, title) or has_text(driver, label("UI_LOGIN_TEXT", "Đăng nhập"))
    assert "mock" not in os.getenv("APP_API_ENABLED", "false").lower()


def test_mob_002_valid_login_by_touch(driver, qa_api, qa_user_a):
    """MOB-002: enter valid QA account by touch and verify its API session."""
    _prepare(driver, qa_api)
    profile = qa_api.me()
    email = find_value(profile, ("email",))
    assert email and str(email).lower() == qa_user_a["email"].lower()
    assert not (has_text(driver, label("UI_LOGIN_TEXT", "Đăng nhập")) and len(edit_fields(driver)) >= 2)


def test_mob_003_invalid_or_missing_login(driver, qa_api, qa_user_a):
    """MOB-003: empty fields and invalid credentials must not establish a session."""
    if len(edit_fields(driver)) < 2:
        try:
            logout_if_possible(driver)
        except Exception:
            pass
    fields = edit_fields(driver)
    if len(fields) < 2:
        pytest.skip("Không mở được màn hình Login; selector/route cần được hiệu chỉnh.")
    fields[0].click()
    fields[0].clear()
    fields[1].click()
    fields[1].clear()
    try:
        driver.hide_keyboard()
    except Exception:
        pass
    tap_text(driver, label("UI_LOGIN_TEXT", "Đăng nhập"), timeout=6)
    assert len(edit_fields(driver)) >= 2, "Empty login unexpectedly left the authentication screen."
    # Wrong credentials are entered through the real UI; use a non-existent
    # reserved QA test-domain address to avoid locking a real user.
    fields = edit_fields(driver)
    fields[0].click(); fields[0].send_keys("missing-mob-003@example.test")
    fields[1].click(); fields[1].send_keys("Invalid-QA-Only-Password")
    try:
        driver.hide_keyboard()
    except Exception:
        pass
    tap_text(driver, label("UI_LOGIN_TEXT", "Đăng nhập"), timeout=6)
    time.sleep(1.5)
    assert len(edit_fields(driver)) >= 2, "Invalid credentials unexpectedly left the login screen."
    bad = qa_api.request("POST", "/auth/login",
        json_body={"email": "not-a-real-user@example.test", "password": "Invalid-QA-Only", "deviceId": "appium-invalid"},
        expected=(401,))
    assert bad.status_code == 401
    assert find_value(bad.json(), ("accessToken", "refreshToken", "access_token", "refresh_token")) is None



def test_mob_004_keyboard_and_login_button(driver, qa_api, qa_user_a):
    """MOB-004: keyboard must not block essential login interactions."""
    if len(edit_fields(driver)) < 2:
        try:
            logout_if_possible(driver)
        except Exception:
            pass

    fields = edit_fields(driver)
    if len(fields) < 2:
        pytest.skip("Login screen does not expose two EditText fields.")

    # First input: verify the keyboard appears after focusing the field.
    fields[0].click()

    WebDriverWait(driver, 5, poll_frequency=0.2).until(
        lambda d: d.is_keyboard_shown(),
        message="Keyboard did not appear after focusing the first login field.",
    )

    fields[0].send_keys("qa-keyboard-check")
    fields[0].clear()

    # Second input: verify the keyboard remains available.
    fields = edit_fields(driver)
    fields[1].click()

    WebDriverWait(driver, 5, poll_frequency=0.2).until(
        lambda d: d.is_keyboard_shown(),
        message="Keyboard did not appear after focusing the second login field.",
    )

    try:
        driver.hide_keyboard()
    except Exception:
        driver.back()

    login_button = candidates(
        driver,
        label("UI_LOGIN_TEXT", "Đăng nhập"),
    )

    assert (
        login_button
        and login_button[0].is_displayed()
        and login_button[0].is_enabled()
    ), "Login button must remain visible and enabled after keyboard dismissal."

def test_mob_005_session_survives_background(driver, qa_api):
    """MOB-005: background/resume should preserve the same authenticated identity."""
    _prepare(driver, qa_api)
    before = qa_api.me()
    before_id = find_value(before, ("userId", "id"))
    driver.background_app(4)
    after = qa_api.me()
    after_id = find_value(after, ("userId", "id"))
    assert before_id == after_id
    assert has_text(driver, label("UI_EXAM_TAB", "Kiểm tra")) or has_text(driver, label("UI_PERSONAL_TAB", "Cá nhân"))


def test_mob_006_expired_session_controlled_fixture():
    """MOB-006: requires an Appium secure-storage expiry fixture, not just an API probe."""
    pytest.skip(
        "BLOCKED: bộ runner chưa có hook được phê duyệt để cài access/refresh hết hạn "
        "vào secure storage của app; API refresh/revocation được kiểm tra ở Postman API-004/005."
    )

def test_mob_007_logout_then_back_and_reopen(driver, qa_api):
    """MOB-007: UI logout and API refresh-token revocation."""
    _prepare(driver, qa_api)
    session = qa_api.session
    assert session is not None

    logout_if_possible(driver)

    WebDriverWait(driver, 10, poll_frequency=0.3).until(
        lambda d: (
            has_text(d, label("UI_LOGIN_TEXT", "Đăng nhập"))
            or len(edit_fields(d)) >= 2
        ),
        message="App did not navigate to Login screen after logout.",
    )

    logout = qa_api.request(
        "POST",
        "/auth/logout",
        token=session.access_token,
        json_body={"refreshToken": session.refresh_token},
        expected=(200,),
    )
    assert logout.status_code == 200

    replay = qa_api.request(
        "POST",
        "/auth/refresh",
        json_body={"refreshToken": session.refresh_token},
    )
    assert replay.status_code == 401

    # Simulate Android Back after logout.
    try:
        driver.back()
    except Exception:
        pass

    time.sleep(1)

    # Reopen the app without clearing its data.
    package = _need_package()

    try:
        driver.terminate_app(package)
    except Exception:
        pass

    driver.activate_app(package)

    # Verify that the logged-out state persists after reopening.
    WebDriverWait(driver, 15, poll_frequency=0.5).until(
        lambda d: (
            has_text(d, label("UI_LOGIN_TEXT", "Đăng nhập"))
            or len(edit_fields(d)) >= 2
        ),
        message=(
            "Login screen was not displayed after reopening the app. "
            "The logged-out state may not have persisted."
        ),
    )

def test_mob_008_protected_exam_screen_without_session(driver, qa_api):
    """MOB-008: unauthenticated app cannot access protected test/result screens."""
    if not _truthy("ALLOW_APP_RESET"):
        pytest.skip("BLOCKED: cần emulator QA chuyên dụng và ALLOW_APP_RESET=true để xóa app data trước test.")
    package = _need_package()
    _adb(os.getenv("DEVICE_UDID", ""), "shell", "pm", "clear", package)
    driver.activate_app(package)
    time.sleep(2)
    assert len(edit_fields(driver)) >= 2 or has_text(driver, label("UI_LOGIN_TEXT", "Đăng nhập"))
    # API-level protected request must independently reject missing auth.
    response = qa_api.request("GET", "/tests")
    assert response.status_code == 401


def test_mob_009_list_and_start_full_test(driver, qa_api):
    """MOB-009: select QA Demo Full Test and verify the server-created attempt."""
    _prepare(driver, qa_api)
    _home(driver)
    start_full_test(driver)
    attempt_id, attempt = _attempt(qa_api)
    assert find_value(attempt, ("attemptId",)) == attempt_id
    assert str(find_value(attempt, ("status",))).upper() == "IN_PROGRESS"
    assert len(find_question_ids(attempt)) == 200
    assert has_text(driver, "1/200") or has_text(driver, "1 / 200") or has_text(driver, "Câu 1")

def test_mob_010_long_question_image_and_small_screen(driver, qa_api):
    """MOB-010: question/options remain readable and tappable on compact viewport."""
    _prepare(driver, qa_api)
    _home(driver)
    start_full_test(driver)
    size = driver.get_window_size()
    assert size["width"] > 0 and size["height"] > 0
    driver.swipe(size["width"] * 0.85, size["height"] * 0.82,
                 size["width"] * 0.85, size["height"] * 0.30, 450)
    # Screen must still expose a usable answer choice after scrolling.
    assert any(candidates(driver, option) for option in ("A", "B", "C", "D"))


def test_mob_011_listening_audio_controls(driver, qa_api):
    """MOB-011: validate Listening audio player controls."""
    _prepare(driver, qa_api)
    _home(driver)
    start_full_test(driver)

    unavailable = candidates(
        driver,
        "Đã nhận nguồn audio nhưng trình phát hiện chưa khả dụng."
    )

    if unavailable:
        pytest.fail(
            "Audio source is available, but Flutter audio player "
            "is not initialized or unavailable."
        )

    play = label("UI_PLAY_AUDIO", "Phát")
    controls = candidates(driver, play)

    if not controls:
        pytest.fail(
            "Expected Listening audio player control, "
            "but no Play control was found."
        )

    controls[0].click()
    pause = label("UI_PAUSE_AUDIO", "Tạm dừng")

    WebDriverWait(driver, 12).until(
        lambda current_driver: (
            has_text(current_driver, pause)
            or has_text(current_driver, "Tạm dừng")
        )
    )

    assert (
        has_text(driver, label("UI_PAUSE_AUDIO", "Tạm dừng"))
        or has_text(driver, "Dừng")
    ), "Audio player did not transition to playing state."


def test_mob_012_audio_background_policy(driver, qa_api):
    """MOB-012: audio interruption is gated by product decision EN-01."""
    policy = _credential("AUDIO_BACKGROUND_POLICY").upper()
    if policy not in {"PAUSE", "CONTINUE"}:
        pytest.skip("BLOCKED: chưa chốt EN-01 (audio pause hay continue khi app chạy nền).")
    _prepare(driver, qa_api)
    _home(driver)
    start_full_test(driver)
    tap_text(driver, label("UI_PLAY_AUDIO", "Phát"), timeout=6)
    driver.background_app(4)
    if policy == "PAUSE":
        assert has_text(driver, label("UI_PLAY_AUDIO", "Phát")) or has_text(driver, "Tiếp tục")
    else:
        assert has_text(driver, label("UI_PAUSE_AUDIO", "Tạm dừng")) or has_text(driver, "Dừng")


def test_mob_013_select_and_change_answer_by_touch(driver, qa_api):
    """MOB-013: A then B; last acknowledged option must be B."""
    _prepare(driver, qa_api)
    _home(driver)
    start_full_test(driver)
    attempt_id, attempt = _attempt(qa_api)
    qids = find_question_ids(attempt)
    assert qids
    select_answer(driver, "A")
    select_answer(driver, "B")
    time.sleep(2)
    refreshed = qa_api.get_attempt(attempt_id)
    assert answer_state(refreshed, qids[0]) == "B"


def test_mob_014_clear_answer_by_touch(driver, qa_api):
    """MOB-014: clear selection; if UI has no clear control report a requirement gap."""
    _prepare(driver, qa_api)
    _home(driver)
    start_full_test(driver)
    attempt_id, attempt = _attempt(qa_api)
    qids = find_question_ids(attempt)
    select_answer(driver, "A")
    if not has_text(driver, label("UI_CLEAR_ANSWER", "Bỏ chọn")):
        pytest.xfail("UI chưa expose thao tác Bỏ chọn; không thể xác nhận clear-null bằng Appium.")
    tap_text(driver, label("UI_CLEAR_ANSWER", "Bỏ chọn"))
    refreshed = qa_api.get_attempt(attempt_id)
    assert answer_state(refreshed, qids[0]) in (None, "")


def test_mob_015_part_navigation_preserves_answers(driver, qa_api):
    """MOB-015: navigation between Part 1 and Part 2 retains server-acknowledged draft."""
    _prepare(driver, qa_api)
    _home(driver)
    start_full_test(driver)
    attempt_id, attempt = _attempt(qa_api)
    qids = find_question_ids(attempt)
    select_answer(driver, "A")
    tap_text(driver, label("UI_PART_2", "Part 2"), timeout=8)
    tap_text(driver, label("UI_PART_1", "Part 1"), timeout=8)
    refreshed = qa_api.get_attempt(attempt_id)
    assert answer_state(refreshed, qids[0]) == "A"


def test_mob_016_reopen_app_recovers_server_draft(driver, qa_api):
    """MOB-016: process restart should recover the same attempt and acknowledged draft."""
    _prepare(driver, qa_api)
    _home(driver)
    start_full_test(driver)
    attempt_id, attempt = _attempt(qa_api)
    qids = find_question_ids(attempt)
    select_answer(driver, "A")
    before = qa_api.get_attempt(attempt_id)
    assert answer_state(before, qids[0]) == "A"
    package = _need_package()
    driver.terminate_app(package)
    driver.activate_app(package)
    time.sleep(3)
    after = qa_api.get_attempt(attempt_id)
    assert answer_state(after, qids[0]) == "A"
    assert find_value(after, ("deadlineAt", "expiresAt")) == find_value(before, ("deadlineAt", "expiresAt"))
    assert has_text(driver, "1/200") or has_text(driver, "1 / 200") or has_text(driver, "Câu 1"), \
        "App process restarted but did not restore the in-progress Full Test screen."


def test_mob_017_network_loss_during_answer_save(driver, qa_api):
    """MOB-017: turn emulator Wi-Fi off during a write; server must not report false save."""
    _prepare(driver, qa_api)
    _home(driver)
    start_full_test(driver)
    attempt_id, attempt = _attempt(qa_api)
    qids = find_question_ids(attempt)
    select_answer(driver, "A")
    assert answer_state(qa_api.get_attempt(attempt_id), qids[0]) == "A"
    udid = os.getenv("DEVICE_UDID", "")
    try:
        _adb(udid, "shell", "svc", "wifi", "disable")
        _adb(udid, "shell", "svc", "data", "disable")
        select_answer(driver, "B")
        time.sleep(2)
        disconnected = qa_api.get_attempt(attempt_id)
        assert answer_state(disconnected, qids[0]) == "A", "Server changed draft without a network acknowledgement."
    finally:
        # Restore the emulator network even if an assertion fails.
        _adb(udid, "shell", "svc", "data", "enable")
        _adb(udid, "shell", "svc", "wifi", "enable")
    time.sleep(2)
    if has_text(driver, "Thử lại") or has_text(driver, "Retry"):
        tap_any(driver, ["Thử lại", "Retry"])
        time.sleep(2)
    refreshed = qa_api.get_attempt(attempt_id)
    assert answer_state(refreshed, qids[0]) in ("A", "B")


def test_mob_018_submit_response_lost_fault_proxy():
    """MOB-018: response-loss test requires Backend-approved fault proxy; otherwise Blocked."""
    if not _truthy("QA_FAULT_PROXY_ENABLED") or not _credential("QA_FAULT_PROXY_URL"):
        pytest.skip("BLOCKED: cần Backend owner phê duyệt fault proxy QA để drop response sau khi request tới server.")
    pytest.skip("Fault-proxy protocol is environment-specific and is deliberately not guessed in this generic runner.")


def test_mob_019_countdown_after_background_and_device_clock():
    """MOB-019: requires a separately approved emulator clock-control fixture."""
    pytest.skip(
        "BLOCKED: runner không tự thay đổi clock thiết bị. Cần emulator QA riêng, "
        "quy trình đổi/khôi phục clock được duyệt và EN-01; không sửa clock của thiết bị thật."
    )


def test_mob_020_voluntary_submit_with_blank_answers(driver, qa_api):
    """MOB-020: submit with correct/wrong/blank sample; verify server finalization."""
    _prepare(driver, qa_api)
    _home(driver)
    start_full_test(driver)
    attempt_id, attempt = _attempt(qa_api)
    qids = find_question_ids(attempt)
    assert len(qids) == 200
    select_answer(driver, "A")
    tap_text(driver, label("UI_NEXT", "Tiếp theo"), timeout=8)
    select_answer(driver, "B")
    tap_submit(driver)
    final = qa_api.get_attempt(attempt_id)
    assert str(find_value(final, ("status",))).upper() in {"SUBMITTED", "COMPLETED", "FINALIZED"}
    score = find_value(final, ("score", "scoreTotal", "totalScore"))
    assert score is not None
    assert answer_state(final, qids[0]) == "A", "First saved answer was not retained."
    assert answer_state(final, qids[1]) == "B", "Second saved answer was not retained."
    assert answer_state(final, qids[2]) in (None, ""), "An intentionally blank question was not blank."
    expected_correct = _credential("EXPECTED_CORRECT_COUNT")
    if expected_correct:
        actual_correct = find_value(final, ("correctCount", "totalCorrect", "numberCorrect"))
        assert actual_correct is not None and int(actual_correct) == int(expected_correct)
    expected = _credential("EXPECTED_TOTAL_SCORE")
    if expected:
        assert int(score) == int(expected)


def test_mob_021_timeout_foreground_background_two_attempts():
    """MOB-021: waits for two short server-side attempts; gated and slow."""
    if not _truthy("ENABLE_SLOW_TIMEOUT_TESTS"):
        pytest.skip("BLOCKED/SLOW: enable only when QA has a short-duration PART attempt fixture and EN-01 is approved.")
    duration = int(os.getenv("TIMEOUT_TEST_DURATION_SECONDS", "300"))
    if duration < 300:
        pytest.skip("Contract minimum durationSeconds is 300; do not shorten by changing database timestamps.")
    pytest.skip("UI path for creating PART attempts must be confirmed against the current Flutter screen; no assumed route is automated here.")


def test_mob_022_repeated_submit_has_one_result(driver, qa_api):
    """MOB-022: rapid UI submit taps plus API replay must not create duplicate results."""
    _prepare(driver, qa_api)
    _home(driver)
    start_full_test(driver)
    attempt_id, attempt = _attempt(qa_api)
    submit_text = label("UI_SUBMIT", "Nộp bài").strip()
    submit_buttons = candidates(driver, submit_text)
    assert submit_buttons, "Submit control is not visible."
    submit_buttons[0].click()
    # Issue a second rapid touch if the control remains enabled before dialog transition.
    try:
        again = candidates(driver, submit_text)
        if again and again[0].is_enabled():
            again[0].click()
    except Exception:
        pass
    tap_any(driver, [label("UI_CONFIRM_SUBMIT", "Xác nhận"), "Nộp bài", "Đồng ý"], timeout=5)
    time.sleep(1.5)
    for _ in range(2):
        replay = qa_api.submit(attempt_id, {})
        assert replay.status_code in (200, 201, 409)
    data = qa_api.history(page=1, size=50)
    ids = [str(obj.get("attemptId") or obj.get("id")) for obj in walk(data)]
    assert ids.count(attempt_id) == 1, "History must contain exactly one result for the submitted attempt."
    final = qa_api.get_attempt(attempt_id)
    assert str(find_value(final, ("status",))).upper() in {"SUBMITTED", "COMPLETED", "FINALIZED"}


def test_mob_023_explanation_only_after_completion(driver, qa_api):
    """MOB-023: answer key hidden in progress, visible only for finalized attempt."""
    _prepare(driver, qa_api)
    _home(driver)
    start_full_test(driver)
    attempt_id, attempt = _attempt(qa_api)
    active = qa_api.get_attempt(attempt_id)
    _assert_no_pre_submit_key(active)
    tap_submit(driver)
    final = qa_api.get_attempt(attempt_id)
    assert find_value(final, ("correctOption", "explanation", "correctCount")) is not None
    _try_review(driver)


def test_mob_024_history_and_results_are_user_scoped(driver, qa_api):
    """MOB-024: User B must not see or read User A's attempt/result."""
    _prepare(driver, qa_api)
    _home(driver)
    start_full_test(driver)
    attempt_id, _ = _attempt(qa_api)
    tap_submit(driver)
    assert str(find_value(qa_api.get_attempt(attempt_id), ("status",))).upper() in {"SUBMITTED", "COMPLETED", "FINALIZED"}
    # Log out in UI before switching account.
    logout_if_possible(driver)
    api_b = QAApiClient()
    api_b.require_qa()
    api_b.login_user_b()
    email_b = _credential("QA_USER_B_EMAIL")
    password_b = _credential("QA_USER_B_PASSWORD")
    login_if_needed(driver, email_b, password_b)
    b_history = api_b.history(page=1, size=50)
    b_ids = [str(obj.get("attemptId") or obj.get("id")) for obj in walk(b_history)]
    assert attempt_id not in b_ids
    denied = api_b.request("GET", f"/attempts/{attempt_id}", token=api_b.session.access_token)
    assert denied.status_code == 403
    _home(driver)
    tap_text(driver, label("UI_PERSONAL_TAB", "Cá nhân"), timeout=8)
    assert has_text(driver, email_b), "Profile did not show User B after switching accounts."
    tap_text(driver, label("UI_HISTORY", "Lịch sử"), timeout=8)
    empty_label = label("UI_HISTORY_EMPTY_TEXT", "Chưa có bài thi nào")
    assert has_text(driver, empty_label), "User B UI history is not in the expected empty state."
    assert attempt_id not in driver.page_source, "User A attempt identifier leaked into User B UI."


def test_mob_025_empty_history_and_pagination(driver, qa_api):
    """MOB-025: User B empty state and User A pagination are checked via UI + API."""
    api_b = QAApiClient()
    api_b.require_qa()
    api_b.login_user_b()
    empty = api_b.history(page=1, size=20)
    items = []
    for obj in walk(empty):
        for key in ("items", "attempts", "results"):
            if isinstance(obj.get(key), list):
                items = obj[key]
                break
        if items:
            break
    assert len(items) == 0, "User B is not a fresh empty-history fixture."
    qa_api.login()
    page1 = qa_api.history(page=1, size=2)
    page2 = qa_api.history(page=2, size=2)
    total = int(find_value(page1, ("total", "totalCount")) or 0)
    if total < 3:
        pytest.skip("User A needs at least three stable attempts to exercise pagination with size=2.")
    ids1 = [str(obj.get("attemptId")) for obj in walk(page1) if obj.get("attemptId")]
    ids2 = [str(obj.get("attemptId")) for obj in walk(page2) if obj.get("attemptId")]
    assert ids1 and ids2, "Pagination pages did not return attempt IDs."
    assert not (set(ids1) & set(ids2)), "Pagination returned duplicate attempt IDs."
    login_if_needed(driver, _credential("QA_EMAIL"), _credential("QA_PASSWORD"))
    _home(driver)
    tap_any(driver, [label("UI_PERSONAL_TAB", "Cá nhân")], timeout=8)
    tap_text(driver, label("UI_HISTORY", "Lịch sử"), timeout=8)
    empty_label = label("UI_HISTORY_EMPTY_TEXT", "Chưa có bài thi nào")
    assert not has_text(driver, empty_label), "User A should have records when pagination precondition is met."
    assert has_text(driver, label("EXAM_TITLE", "QA Demo 200 Questions")), \
        "User A history does not show the seeded Full Test title."


def test_mob_026_full_android_api_e2e(driver, qa_api):
    """MOB-026: full Android/API/media flow; live media and audio output are mandatory."""
    if not _truthy("AUDIO_OUTPUT_VERIFIED"):
        pytest.skip("BLOCKED: Appium không xác nhận được âm thanh ra loa; tester phải kiểm tra media thật và đặt AUDIO_OUTPUT_VERIFIED=true.")
    _prepare(driver, qa_api)
    _home(driver)
    start_full_test(driver)
    attempt_id, attempt = _attempt(qa_api)
    qids = find_question_ids(attempt)
    assert len(qids) == 200
    audio_control = candidates(driver, label("UI_PLAY_AUDIO", "Phát"))
    if not audio_control:
        pytest.skip("BLOCKED: active question does not expose real media player controls; seed full media fixture.")
    audio_control[0].click()
    time.sleep(1)
    # Change one choice and persist a second; clear control is attempted only if provided.
    select_answer(driver, "A")
    select_answer(driver, "B")
    if has_text(driver, label("UI_CLEAR_ANSWER", "Bỏ chọn")):
        tap_text(driver, label("UI_CLEAR_ANSWER", "Bỏ chọn"))
    saved = qa_api.get_attempt(attempt_id)
    assert str(find_value(saved, ("status",))).upper() == "IN_PROGRESS"
    selected = answer_state(saved, qids[0])
    if has_text(driver, label("UI_CLEAR_ANSWER", "Bỏ chọn")):
        assert selected in (None, ""), "Clear action was not reflected in the server draft."
    else:
        assert selected == "B", "Second touch selection was not reflected in the server draft."
    tap_submit(driver)
    final = qa_api.get_attempt(attempt_id)
    assert str(find_value(final, ("status",))).upper() in {"SUBMITTED", "COMPLETED", "FINALIZED"}
    history = qa_api.history(page=1, size=50)
    assert attempt_id in [str(obj.get("attemptId") or obj.get("id")) for obj in walk(history)]
    _try_review(driver)
