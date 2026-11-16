from __future__ import annotations

import os
import time
from typing import Iterable

from appium.webdriver.common.appiumby import AppiumBy
from selenium.common.exceptions import NoSuchElementException, TimeoutException
from selenium.webdriver.support.ui import WebDriverWait


def label(key: str, default: str) -> str:
    return os.getenv(key, default).strip()


def _xpath_literal(value: str) -> str:
    if "'" not in value:
        return f"'{value}'"
    if '"' not in value:
        return f'"{value}"'
    pieces = value.split("'")
    return "concat(" + ", \"'\", ".join(f"'{p}'" for p in pieces) + ")"


def candidates(driver, text: str):
    escaped = text.replace('"', '\\"')
    found = []
    try:
        found.extend(driver.find_elements(AppiumBy.ANDROID_UIAUTOMATOR,
            f'new UiSelector().textContains("{escaped}")'))
    except Exception:
        pass
    try:
        x = _xpath_literal(text)
        found.extend(driver.find_elements(AppiumBy.XPATH,
            f'//*[@text={x} or contains(@text,{x}) or @content-desc={x} or contains(@content-desc,{x})]'))
    except Exception:
        pass
    # Preserve order, discard invisible and duplicates.
    unique = []
    seen = set()
    for element in found:
        try:
            if element.id not in seen and element.is_displayed():
                seen.add(element.id)
                unique.append(element)
        except Exception:
            continue
    return unique


def has_text(driver, text: str) -> bool:
    return bool(candidates(driver, text))


def wait_text(driver, text: str, timeout: int = 12):
    try:
        return WebDriverWait(driver, timeout).until(lambda d: candidates(d, text)[0] if candidates(d, text) else False)
    except TimeoutException as exc:
        raise AssertionError(f"Expected visible UI text not found: {text!r}") from exc


def tap_text(driver, text: str, timeout: int = 12, index: int = 0):
    WebDriverWait(driver, timeout).until(lambda d: len(candidates(d, text)) > index)
    element = candidates(driver, text)[index]
    element.click()
    return element


def tap_any(driver, texts: Iterable[str], timeout: int = 4):
    deadline = time.time() + timeout
    while time.time() < deadline:
        for text in texts:
            items = candidates(driver, text)
            if items:
                items[0].click()
                return text
        time.sleep(0.25)
    raise AssertionError(f"None of the UI actions were found: {list(texts)}")


def edit_fields(driver):
    try:
        return [x for x in driver.find_elements(AppiumBy.CLASS_NAME, "android.widget.EditText") if x.is_displayed()]
    except Exception:
        return []


def enter_login_credentials(driver, email: str, password: str):
    fields = edit_fields(driver)
    if len(fields) < 2:
        raise AssertionError(f"Login form should expose two editable fields; found {len(fields)}.")
    fields[0].click()
    fields[0].clear()
    fields[0].send_keys(email)
    fields[1].click()
    fields[1].clear()
    fields[1].send_keys(password)
    try:
        driver.hide_keyboard()
    except Exception:
        pass
    tap_text(driver, label("UI_LOGIN_TEXT", "Đăng nhập"), timeout=8)


def login_if_needed(driver, email: str, password: str):
    login_label = label("UI_LOGIN_TEXT", "Đăng nhập")
    # Treat presence of two edit fields as a login form, not just a nav/menu label.
    if len(edit_fields(driver)) >= 2:
        enter_login_credentials(driver, email, password)
        time.sleep(1)
    if has_text(driver, login_label) and len(edit_fields(driver)) >= 2:
        raise AssertionError("Login did not leave the login form.")
    return driver


def logout_if_possible(driver):
    personal = label("UI_PERSONAL_TAB", "Cá nhân")
    if has_text(driver, personal):
        tap_text(driver, personal, timeout=6)
    tap_text(driver, label("UI_LOGOUT", "Đăng xuất"), timeout=6)
    tap_any(driver, ["Đăng xuất", "Xác nhận", "Đồng ý"], timeout=3)


def open_full_test(driver):
    tap_text(driver, label("UI_EXAM_TAB", "Kiểm tra"), timeout=10)
    tap_text(driver, label("UI_FULL_TEST", "Thi đầy đủ"), timeout=12)
    exam_title = label("EXAM_TITLE", "QA Demo 200 Questions")
    if has_text(driver, exam_title):
        tap_text(driver, exam_title, timeout=10)
    tap_any(driver, [label("UI_START_TEST", "Bắt đầu"), "Bắt đầu làm bài", "Vào thi"], timeout=12)
    time.sleep(1.5)


def start_full_test(driver):
    open_full_test(driver)
    if not (has_text(driver, "1/200") or has_text(driver, "1 / 200") or has_text(driver, "Câu 1")):
        # Allow screen rendering to complete before diagnosing.
        time.sleep(2)
    if not (has_text(driver, "1/200") or has_text(driver, "1 / 200") or has_text(driver, "Câu 1")):
        raise AssertionError("Full Test taking screen was not detected (expected question 1/200).")


def select_answer(driver, option: str):
    # The current visible item must belong to the active question. Option labels are kept simple.
    items = candidates(driver, option)
    if not items:
        raise AssertionError(f"Answer option {option} was not visible.")
    items[0].click()
    time.sleep(0.5)


def tap_submit(driver):
    tap_any(driver, [
        label("UI_SUBMIT", "Nộp bài").strip(),
        "Nộp bài thi",
        "Hoàn thành",
    ], timeout=8)
    tap_any(driver, [label("UI_CONFIRM_SUBMIT", "Xác nhận"), "Nộp bài", "Đồng ý"], timeout=5)
    time.sleep(1.5)


def active_attempt_from_history(api):
    data = api.history(page=1, size=50)
    items = []
    for obj in _walk(data):
        for k in ("items", "attempts", "results"):
            if isinstance(obj.get(k), list):
                items.extend(x for x in obj[k] if isinstance(x, dict))
    for item in items:
        state = str(item.get("status") or item.get("state") or "").upper()
        attempt_id = item.get("attemptId") or item.get("id")
        if attempt_id and state in {"IN_PROGRESS", "ACTIVE"}:
            return str(attempt_id)
    return None


def _walk(obj):
    if isinstance(obj, dict):
        yield obj
        for v in obj.values():
            yield from _walk(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _walk(v)


def answer_state(attempt: dict, question_id: str):
    for obj in _walk(attempt):
        arr = obj.get("answers") or obj.get("draftAnswers")
        if isinstance(arr, list):
            for answer in arr:
                if isinstance(answer, dict) and answer.get("questionId") == question_id:
                    return answer.get("selectedOption")
    return None
