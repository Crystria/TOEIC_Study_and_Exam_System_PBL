from __future__ import annotations

import os
import re
import uuid
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import requests


def _is_local_url(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return host in {"localhost", "127.0.0.1", "10.0.2.2"} or (
        re.fullmatch(r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}", host) is not None
    ) or re.fullmatch(r"192\.168\.\d{1,3}\.\d{1,3}", host) is not None or (
        re.fullmatch(r"172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}", host) is not None
    )


def walk(obj: Any):
    if isinstance(obj, dict):
        yield obj
        for value in obj.values():
            yield from walk(value)
    elif isinstance(obj, list):
        for value in obj:
            yield from walk(value)


def find_value(obj: Any, keys: tuple[str, ...] | list[str]):
    for item in walk(obj):
        for key in keys:
            value = item.get(key)
            if value is not None:
                return value
    return None


def find_question_ids(obj: Any) -> list[str]:
    seen: list[str] = []
    for item in walk(obj):
        qid = item.get("questionId")
        if isinstance(qid, str):
            try:
                uuid.UUID(qid)
            except ValueError:
                continue
            if qid not in seen:
                seen.append(qid)
    return seen


def find_items(obj: Any) -> list[dict]:
    for item in walk(obj):
        for key in ("items", "attempts", "results"):
            value = item.get(key)
            if isinstance(value, list):
                return [x for x in value if isinstance(x, dict)]
    return []


@dataclass
class LoginSession:
    access_token: str
    refresh_token: str
    user_id: str | None
    email: str


class QAApiClient:
    """Small read/write client used only against an isolated local QA Gateway."""

    def __init__(self, base_url: str | None = None, gateway_origin: str | None = None):
        self.base_url = (base_url or os.getenv("API_BASE_URL", "http://127.0.0.1:3000/api/v1")).rstrip("/")
        self.gateway_origin = (gateway_origin or os.getenv("GATEWAY_ORIGIN", "http://127.0.0.1:3000")).rstrip("/")
        if not _is_local_url(self.base_url) or not _is_local_url(self.gateway_origin):
            raise RuntimeError("QA API target must be a localhost/private-LAN URL. Refusing non-local target.")
        self.http = requests.Session()
        self.http.headers.update({"Accept": "application/json", "X-Correlation-ID": str(uuid.uuid4())})
        self.session: LoginSession | None = None

    def request(self, method: str, path: str, *, token: str | None = None,
                json_body: Any = None, headers: dict[str, str] | None = None,
                expected: tuple[int, ...] | None = None, timeout: int = 25) -> requests.Response:
        hdrs = dict(headers or {})
        if token:
            hdrs["Authorization"] = f"Bearer {token}"
        response = self.http.request(
            method, f"{self.base_url}/{path.lstrip('/')}",
            json=json_body, headers=hdrs, timeout=timeout,
        )
        if expected and response.status_code not in expected:
            raise AssertionError(f"{method} {path}: expected {expected}, got HTTP {response.status_code}")
        return response

    def require_qa(self) -> dict:
        response = self.http.get(f"{self.gateway_origin}/ready", timeout=10)
        response.raise_for_status()
        payload = response.json()
        if payload.get("status") != "ready" or payload.get("qa") is not True:
            raise RuntimeError("Gateway is not explicitly marked ready + qa=true. QA writes are blocked.")
        return payload

    def login(self, email: str | None = None, password: str | None = None,
              device_id: str | None = None) -> LoginSession:
        email = email or os.getenv("QA_EMAIL", "")
        password = password or os.getenv("QA_PASSWORD", "")
        if not email or not password:
            raise RuntimeError("Set QA_EMAIL and QA_PASSWORD in local .env.")
        response = self.request("POST", "/auth/login",
                                json_body={"email": email, "password": password,
                                           "deviceId": device_id or os.getenv("DEVICE_ID", "appium-qa")},
                                expected=(200,))
        data = response.json()
        access = find_value(data, ("accessToken", "access_token"))
        refresh = find_value(data, ("refreshToken", "refresh_token"))
        user_id = find_value(data, ("userId", "id"))
        if not access or not refresh:
            raise AssertionError("Login response did not contain access/refresh token fields.")
        self.session = LoginSession(str(access), str(refresh), str(user_id) if user_id else None, email)
        return self.session

    def login_user_b(self) -> LoginSession:
        return self.login(os.getenv("QA_USER_B_EMAIL"), os.getenv("QA_USER_B_PASSWORD"),
                          os.getenv("DEVICE_ID", "appium-qa") + "-b")

    def authed(self, method: str, path: str, **kwargs) -> requests.Response:
        if not self.session:
            self.login()
        return self.request(method, path, token=self.session.access_token, **kwargs)

    def me(self) -> dict:
        response = self.authed("GET", "/users/me", expected=(200,))
        return response.json()

    def list_tests(self, keyword: str = "QA Demo 200 Questions") -> dict:
        response = self.authed("GET", "/tests?page=1&size=50&keyword=" +
                               requests.utils.quote(keyword, safe=""), expected=(200,))
        return response.json()

    def find_test_id(self, title: str | None = None) -> str:
        title = title or os.getenv("EXAM_TITLE", "QA Demo 200 Questions")
        response = self.authed("GET", "/tests?page=1&size=50&keyword=" +
                               requests.utils.quote(title, safe=""), expected=(200,))
        data = response.json()
        for item in walk(data):
            label = str(item.get("testName") or item.get("title") or item.get("name") or "")
            test_id = item.get("testId") or item.get("id")
            if title.lower() in label.lower() and isinstance(test_id, str):
                return test_id
        candidate = find_value(data, ("testId",))
        if isinstance(candidate, str):
            return candidate
        raise AssertionError(f"Test '{title}' was not found in GET /tests.")

    def history(self, page: int = 1, size: int = 50) -> dict:
        response = self.authed("GET", f"/attempts?page={page}&size={size}", expected=(200,))
        return response.json()

    def get_attempt(self, attempt_id: str) -> dict:
        response = self.authed("GET", f"/attempts/{attempt_id}", expected=(200,))
        return response.json()

    def start_full_attempt(self, test_id: str | None = None) -> tuple[str, dict]:
        test_id = test_id or self.find_test_id()
        response = self.authed("POST", f"/tests/{test_id}/attempts",
                               headers={"Idempotency-Key": str(uuid.uuid4())},
                               expected=(201,), timeout=40)
        data = response.json()
        attempt_id = find_value(data, ("attemptId",))
        if not attempt_id:
            raise AssertionError("Start attempt response did not contain attemptId.")
        return str(attempt_id), data

    def save_answer(self, attempt_id: str, question_id: str, option: str | None) -> dict:
        response = self.authed("PUT", f"/attempts/{attempt_id}/answers/{question_id}",
                               json_body={"selectedOption": option}, expected=(200,))
        return response.json()

    def save_draft(self, attempt_id: str, answers: list[dict]) -> dict:
        response = self.authed("PUT", f"/attempts/{attempt_id}/draft",
                               json_body={"answers": answers}, expected=(200,))
        return response.json()

    def submit(self, attempt_id: str, payload: dict | None = None) -> requests.Response:
        return self.authed("POST", f"/attempts/{attempt_id}/submit",
                           json_body=payload if payload is not None else {},
                           expected=(200, 201, 409), timeout=60)

    def logout(self) -> requests.Response:
        if not self.session:
            raise RuntimeError("No active API session to logout.")
        response = self.request("POST", "/auth/logout", token=self.session.access_token,
                                json_body={"refreshToken": self.session.refresh_token},
                                expected=(200,))
        self.session = None
        return response
