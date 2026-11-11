# TOEIC Offline Test Data – Full Feature Pack

## Mục đích và baseline

Bộ dữ liệu mở rộng này phục vụ kiểm thử **các feature hiện diện trong source Flutter `lib(4).zip`** ở chế độ `API_ENABLED=false`, không cần API Gateway, PostgreSQL hoặc các Backend services. Các fixture được tạo từ một số export trước đó; hai catalog Vocabulary và Grammar đã được đối chiếu với source `lib(4).zip` ngày 10/11/2026.

Feature được bao phủ: Auth & Session, Profile & Settings, Home, Learning (Vocabulary, Review/Flashcard, Grammar, Quick Quiz), Mock Test, Analytics, AI Chat và Core/user-scoped local storage.

**Quan trọng:** gói chứa cả (1) fixture khớp dữ liệu mock trong source hiện tại và (2) dữ liệu tham khảo mở rộng chưa được nối vào app. Các file có hậu tố `NOT_WIRED`, `TESTER_ONLY` hoặc `REFERENCE` không tự được ứng dụng nạp.

## Cấu trúc

```text
TOEIC_Offline_Test_Data_Full/
├── README.md
├── manifest.json
├── file_manifest.json
├── auth/                # registration, login, email action, session
├── profile/             # profile records, update cases, settings
├── home/                # dashboard demo and UI states
├── learning/            # vocabulary, review, grammar, quiz, local progress
├── exam/                # current 200-question mock exam, answer keys, score map
├── attempts/             # attempt/history, submit/deadline/network scenarios
├── analytics/           # 7d/30d/all-time, streak, prediction, weak areas, history
├── ai_chat/             # four seed conversations, messages, quota, failures, contexts
├── core/                # API-disabled config and user-scoped storage keys
├── mappings/            # feature -> fixture mapping and MOB mapping
├── media/               # actual media gaps in current source
├── appium/              # offline runner env template
└── tools/               # validators, runtime timestamp generator, Dart exporter
```

## Cách dùng

### 1. Giải nén, kiểm tra JSON fixtures

```powershell
Expand-Archive .\TOEIC_Offline_Test_Data_Full.zip -DestinationPath .\test-data
cd .\test-data\TOEIC_Offline_Test_Data_Full
python .\tools\validate_all_fixtures.py
```

Kết quả kỳ vọng: `OK: parsed ... JSON files ... consistent.`

Tạo lại timestamp của các vocabulary progress snapshots theo ngày chạy hiện tại:

```powershell
python .\tools\generate_runtime_fixtures.py
```

### 2. Build app offline

Tại `apps/mobile`:

```powershell
flutter build apk --debug --dart-define=APP_ENV=development --dart-define=API_ENABLED=false
```

Giữ `API_ENABLED=false`. Chỉ hai catalog Vocabulary/Grammar đã được allow-list trong `pubspec.yaml`; tuyệt đối không khai báo toàn bộ `test_data/` vì các file `TESTER_ONLY`, tài khoản QA và answer sets chỉ dành cho tester.

### 3. Auth – đăng ký tài khoản mock

Các account input templates được giữ trong file QA riêng và không được preload vào ứng dụng. `FakeAuthRepository` khởi tạo map tài khoản rỗng, sau đó giữ account và email-action ticket trong RAM.

- Tạo một tài khoản giả lập chưa xác minh và một tài khoản đã xác minh.
- Hoàn tất xác minh email mô phỏng trong cùng app process trước khi login.
- Dùng hai tài khoản giả lập riêng để kiểm tra user-scoped storage và account switching.
- Không đặt mật khẩu thật, mật khẩu dùng chung của team hoặc token trong tài liệu/fixture được chia sẻ.

Kết thúc app process có thể làm mất account/ticket giả lập; cần tạo lại.

### 4. Profile & Settings

Dùng `profile/profile_records.json`, `profile/profile_update_scenarios.json` và `profile/settings_preferences.json`. Email bị khóa không cho sửa trong UI. Reminder toggle chỉ lưu local preference; ứng dụng hiện chưa lập lịch notification hệ điều hành. Đổi mật khẩu chỉ có ở FakeAuth mode; Backend mode hiện chưa có API tương ứng.

### 5. Home và Analytics

`home/dashboard_demo_snapshot.json` phản ánh chính xác các giá trị demo từ `MockAnalyticsRepository` + `AnalyticsHomeRepository`: predicted score 685, streak 12 ngày, 248 từ, 14 grammar lessons, 5 mock tests, 4 activity hôm nay, 15 due flashcards. Đây là dữ liệu demo, không phải kết quả tích lũy từ account vừa đăng nhập.

Dùng các file `analytics/progress_*.json`, `streak_and_prediction.json`, `history_*.json`, `query_edge_cases.json` để đối chiếu biểu đồ và danh sách.

### 6. Learning

- `learning/vocabulary_catalog_current_source.json`: 6 flashcards thực sự hard-code trong `VocabularyProvider._defaultCatalog`.
- `learning/review_selector_mock_data.json`: một bộ data khác, 9 từ với IDs `v1-v9`, hard-code trong `ReviewSelectWordsProvider`. Không nhầm IDs này với `t1-v1`...
- `learning/grammar_catalog_current_source.json`: 8 bài học từ `GrammarCatalog`.
- `learning/vocabulary_progress/*.json`: JSON shape chính xác của `VocabularyProgressSnapshot` dùng bởi SharedPreferences.
- `learning/grammar_progress_scenarios.json`: JSON shape chính xác (`startedLessonIds`, `completedLessonIds`, `revisions`).
- `learning/quick_quiz_scenarios.json`: 5-question quiz reference.

**Khả năng giới hạn:** mục tiêu từ vựng mặc định là 20/ngày, nhưng source local chỉ có 6 words. Để chạy Quick Quiz offline, giảm daily goal xuống 5, học 5 từ khác nhau trong cùng ngày. Không thể hoàn thành mục tiêu 20 từ bằng catalog hiện tại. `vocabulary_extended_reference_NOT_WIRED.json` chứa thêm từ tham khảo, nhưng app không hiển thị những từ này.

### 7. Mock Test

Các thư mục `exam/` và `attempts/` được giữ lại từ bộ Offline Test Data trước đó. `question_index_reference.json` contains 200 IDs/Part/options references; `answer_key_TESTER_ONLY.json` and answer sets contain answer keys for tester comparison only. Score mapping is tagged non-official.

Xuất toàn bộ text, options, groups, transcript/asset metadata trực tiếp từ source hiện tại bằng Dart exporter ở bước 8.

### 8. Xuất mock content hiện tại từ source

Copy file `tools/export_all_current_app_mock_data.dart` vào `apps/mobile/tool/` rồi chạy từ thư mục `apps/mobile`:

```powershell
New-Item -ItemType Directory -Force .\tool | Out-Null
# Copy exporter vào .\tool\export_all_current_app_mock_data.dart

dart run .\tool\export_all_current_app_mock_data.dart .\test_data\offline_source_export
```

Script xuất current exam question bank, catalog/score map, grammar lessons, AI Chat conversations và Analytics demo data. Vocabulary local list và Review Selector map là private trong source nên được duy trì dưới dạng static JSON fixture trong pack.

### 9. AI Chat

`AiChatDependencies.backendIntegrationSafetyPassed=false`. Repository local khởi tạo bốn cuộc trò chuyện, trả câu trả lời mô phỏng và usage preview 20/3/17. Conversations/messages/usage là in-memory; reset user scope khôi phục lại bốn conversation seed. Không bật API AI chỉ bằng cách thay cờ; cần hoàn thành security/identity review trong Backend trước.

## Các giới hạn quan trọng

1. JSON fixtures không tự được app load. Chúng dùng làm test data, oracle và tham chiếu; app chỉ sử dụng các mock data được hard-code hoặc local storage hiện có.
2. Local Auth accounts/tickets mất khi app process kết thúc.
3. Mock Exam attempt, draft, result/history hiện ở in-memory repositories; restart persistence và server ownership/idempotency không được chứng minh bằng offline test.
4. Analytics/Home là demo values, không được tính từ các fixture progress của tài khoản test.
5. AudioUrl hiện trống, `VocabularyProvider.playAudio()` là TODO; media asset thật không có trong archive. Không kết luận audio playback Pass.
6. AI Chat chỉ trả lời bằng mock string, không phải LLM/AI API thật.
7. Backend JWT, refresh token, server acknowledgement, ownership, deadline server-side, submit idempotency, API rate limit và E2E với API thật phải để `BLOCKED`/`NOT TESTED` ở offline mode.
8. `answer_key_TESTER_ONLY.json`, `answer_sets/*` và file full question bank exporter tuyệt đối không được đóng gói vào bản release production.

## Các kiểm tra dữ liệu đã bao phủ

- Auth: valid/invalid/mismatch/duplicate/unverified, verification/reset ticket behavior, session and account-switch.
- Profile/Settings: update profile, disabled email edit, optional phone, reminder toggle, goal bounds, legacy data ownership.
- Home: loading/loaded/error, demo metrics, missing user name, account-switch.
- Learning: vocabulary progress snapshots, daily goal, review grades, review-selector records, 8 grammar lessons/progress, 5-question quiz, quiz retake.
- Mock Test: 200 questions, 7 Parts, 42 groups, answer sets, attempt/history/deadline/network/duplicate-submit references.
- Analytics: 7d/30d/all time, activity, trends, predicted score, weak areas, full/part history, pagination boundaries.
- AI Chat: 4 static conversations, messages, usage preview, create/rename/delete/reset and failure kinds.

## Bảo mật dữ liệu

All email addresses use reserved `.test` domain. Phone numbers are synthetic. Passwords are local QA values only; never reuse real credentials. Keep tester-only answer keys outside the app binary and production repository.


## Runtime integration in current source

The current source now loads only `learning/vocabulary_catalog_current_source.json` and `learning/grammar_catalog_current_source.json` into the existing Vocabulary and Grammar providers while running a **debug** build with `APP_ENV=development` and `API_ENABLED=false`. Other fixture files remain QA references. The Flutter asset allow-list intentionally excludes QA credentials, tester answer keys, attempt payloads, Appium files and tools.


## Phase N – tách Offline Fixtures và Backend QA

`test_data/` hiện được xem là **offline namespace**. Các đường dẫn cũ được giữ nguyên để không phá `pubspec.yaml`, debug loader hoặc test hiện có. Backend QA được đặt riêng tại `test_data/backend_qa/`:

- `backend_qa/contract_examples/`: dữ liệu synthetic để kiểm thử parser/DTO. Script tạo timestamp tuyệt đối và UUIDv5 giả lập ổn định; **không phải API response thật và không được dùng làm seed/ID để gọi Backend**.
- `backend_qa/live/`: chỉ chứa ID/response đã được capture từ QA overlay thực tế, sau khi khử bí mật. Folder này được git-ignore; Phase N chưa có live artifact vì QA seed cần chạy trong Backend workspace.
- `backend_qa/templates/`: template rỗng cho registry ID thật, không chứa ID tự tạo.

### Sinh API DTO contract examples

Từ thư mục gốc Mobile project:

```powershell
python .\test_data\tools\build_backend_qa_contract_fixtures.py
python .\test_data\tools\validate_phase_n.py
python -m unittest discover -s .\test_data\tools\tests -v
```

Tool chuyển Analytics relative time sang `asOf`, `from`, `completedAt`, `dailyActivity.date`, `lastActivityDate`; đồng thời chuyển Grammar sections sang `contentMarkdown` theo learner DTO. UUIDv5 chỉ dùng kiểm thử parser.

### Ghi nhận testId thật do Backend tạo

Sau khi Backend owner đã bật QA overlay, xác nhận `/ready` có `qa: true` và chạy `npm run qa:seed` trong Backend workspace, thực hiện tại Mobile project:

```powershell
python .\test_data\tools\capture_backend_qa_seed_id.py
```

Tool chỉ đọc `fixture.testId` và đếm `fixture.accounts`; không sao chép account/email/password/token hoặc raw seed payload. Output nằm trong `backend_qa/live/seed_id_registry.json` và không được commit mặc định. Nếu `artifacts/qa/seed.json` thay đổi schema, dừng và xác nhận lại với Backend owner thay vì đoán field.

### Validator an toàn

`validate_phase_n.py` và `validate_all_fixtures.py` bỏ qua namespace auth, exam/tester artifacts và `backend_qa/live`; `validate_fixtures.py` chỉ kiểm tra cấu trúc Part/score, không đọc question index/answer key/answer sets. Các validator này không chứng minh kết nối Backend hay E2E API.

### Provenance

`manifest.json` ghi rõ `lib(4).zip` là baseline của `lib/`, augmented project là project assembly, và ba overlay L/Hotfix/M được áp dụng. Chỉ hai catalog Vocabulary/Grammar được xác nhận source-aligned. Các Analytics/local scenario cũ được giữ ở offline namespace; không tuyên bố rằng chúng là phản hồi Backend hoặc được export lại toàn bộ từ source mới.
