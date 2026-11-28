# Hướng dẫn nhận code, chạy dự án và đưa đề thi vào database

Cập nhật theo code ngày **10/11/2026**. Các lệnh dùng **Windows PowerShell**, chạy tại **thư mục gốc repository**, trừ khi có ghi chú khác. Trên Windows dùng `npm.cmd` để tránh lỗi Execution Policy của `npm.ps1`.

**Để có ngay đề và nội dung đang chạy trên máy người bàn giao:** người bàn giao chuẩn bị gói dữ liệu ở mục 1; người nhận làm lần lượt mục 2–7. GitHub chỉ chuyển code và các file được commit; **không chuyển PostgreSQL, MinIO, tài khoản hay cấu hình local**.

## 1. Người bàn giao chuẩn bị trước khi gửi cho bạn

### 1.1. Code cần có trên GitHub

Đảm bảo commit cả source mới, migrations, `package-lock.json`, các file env mẫu, `scripts/content/`, và tài liệu này. Nếu bàn giao cả bộ nguồn ETS, cần thêm `data/toeic/ets-2023-test-01/` và `docs/TEST 1/`; kiểm tra dung lượng từng file trước khi push. Bộ nguồn này dùng để đối chiếu/biên tập, **không tự được nhập vào DB khi chạy ứng dụng**.

Xem các thay đổi trước khi chọn file để commit:

```powershell
git status --short
git diff --stat
# Sau khi git add các file cần bàn giao:
git diff --cached --stat
git diff --cached --name-only
```

Không commit `.env`, `.env.local`, `secrets/`, `private/`, token hoặc `import-state.local.json`. Không cần commit `node_modules/`, Prisma client sinh tự động hay `.next/`.

### 1.2. Xuất dữ liệu đang có để máy bạn nhận được đề thật

Đây là cách bàn giao đề **ETS 2023 - Test 01** và nội dung Learning đang có mà không phụ thuộc checkpoint nhập đề trên máy cũ. Gói gồm **5 database và các object MinIO**, giữ nguyên ID câu hỏi/nhóm/đề cùng đường dẫn media. Chỉ sao chép `dataset.json` hoặc chỉ backup `exam_db` sẽ chưa đủ.

Các lệnh dưới dùng stack Compose mặc định: PostgreSQL user `toeic`, các DB `auth_db`, `question_db`, `exam_db`, `learning_db`, `analytics_db`; MinIO có alias `local`, bucket `toeic-media`, avatar `toeic-user`. Nếu máy nguồn đang dùng DB test/tên bucket khác, phải đối chiếu cấu hình runtime và sửa đúng tên trước khi xuất. Không lấy nhầm database trống của stack khác.

Cho các thao tác đang chạy hoàn tất và chờ thống kê cập nhật, sau đó dừng Web/CMS và các backend để dữ liệu không đổi trong lúc xuất. Nếu chạy Node trên host, `Ctrl+C` ở từng terminal. Nếu chạy bằng Compose:

```powershell
docker compose -f docker-compose.yml -f docker-compose.apps.yml stop web admin-cms api-gateway auth-service question-bank-service exam-service learning-service analytics-service
```

Giữ PostgreSQL và MinIO đang chạy. Xuất vào `private/` để không bị đưa lên GitHub:

```powershell
$ErrorActionPreference = 'Stop'
$backup = Join-Path (Get-Location).Path ('private/handoff-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backup | Out-Null

foreach ($dbName in @('auth_db', 'question_db', 'exam_db', 'learning_db', 'analytics_db')) {
    docker compose exec -T postgres pg_dump -U toeic -d $dbName -Fc --no-owner --no-acl -f "/tmp/$dbName.dump"
    if ($LASTEXITCODE -ne 0) { throw "Xuất DB thất bại: $dbName" }
    docker compose cp "postgres:/tmp/$dbName.dump" "$backup/$dbName.dump"
    if ($LASTEXITCODE -ne 0) { throw "Chép backup thất bại: $dbName" }
}

docker compose exec -T minio sh -c 'mkdir -p /tmp/toeic-handoff'
if ($LASTEXITCODE -ne 0) { throw 'Không tạo được thư mục xuất media' }
docker compose exec -T minio mc mirror local/toeic-media /tmp/toeic-handoff/toeic-media
if ($LASTEXITCODE -ne 0) { throw 'Xuất media thất bại' }
docker compose cp minio:/tmp/toeic-handoff/toeic-media "$backup/toeic-media"
if ($LASTEXITCODE -ne 0) { throw 'Chép media thất bại' }

# Nếu bucket avatar đã tồn tại, xuất thêm:
docker compose exec -T minio mc stat local/toeic-user
if ($LASTEXITCODE -eq 0) {
    docker compose exec -T minio mc mirror local/toeic-user /tmp/toeic-handoff/toeic-user
    if ($LASTEXITCODE -ne 0) { throw 'Xuất avatar thất bại' }
    docker compose cp minio:/tmp/toeic-handoff/toeic-user "$backup/toeic-user"
    if ($LASTEXITCODE -ne 0) { throw 'Chép avatar thất bại' }
}

git rev-parse HEAD | Set-Content -Encoding utf8 "$backup/source-commit.txt"
Get-ChildItem -LiteralPath $backup
```

`pg_dump` ghi file trong container rồi `docker compose cp` ra máy, tránh làm hỏng file nhị phân qua toán tử `>` của Windows PowerShell. Các lệnh trên không xóa dữ liệu nguồn. Nếu `mc stat` báo lỗi kết nối/quyền thay vì bucket chưa tồn tại, xử lý lỗi đó trước khi coi gói bàn giao đã đủ.

Gửi riêng thư mục `$backup` cho người nhận, kèm tên branch/commit và **tài khoản test ACTIVE** để đăng nhập: một `CONTENT_ADMIN`, một `SYSTEM_ADMIN` nếu muốn thử quản lý người dùng. Gói có tài khoản, mật khẩu đã hash và lịch sử học/thi, nên chia sẻ riêng trong nhóm, không commit hoặc upload lên repository công khai. Không cần gửi RSA private key hay toàn bộ `.env` của máy nguồn.

Để chạy lại backend máy nguồn sau khi xuất:

```powershell
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d --wait --wait-timeout 600 api-gateway
```

Nếu trước đó chạy backend/FE trên host, mở lại các terminal tương ứng.

## 2. Máy người nhận: cài công cụ và lấy code

Cần Git, **Node.js 22** (theo `.nvmrc`), npm 10+, Docker Desktop đang chạy Linux containers và Docker Compose 2.22+. Lần đầu cần Internet để tải dependency/image. Nên dành khoảng 8 GB RAM cho Docker nếu chạy đủ backend và hạ tầng; thời gian build phụ thuộc máy.

```powershell
git clone <URL_REPOSITORY_GITHUB>
Set-Location TOEIC_Study_and_Exam_System_PBL
# Nếu người bàn giao dùng branch riêng: git switch <TEN_BRANCH>
node --version
npm.cmd --version
docker compose version
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'Cài dependency thất bại' }
npm.cmd run setup:env
if ($LASTEXITCODE -ne 0) { throw 'Tạo env thất bại' }
node scripts/generate-access-keys.mjs
if ($LASTEXITCODE -ne 0) { throw 'Tạo RSA key thất bại' }
node scripts/generate-auth-secrets.mjs
if ($LASTEXITCODE -ne 0) { throw 'Tạo Auth secret thất bại' }
```

Thay các giá trị `<...>` trước khi chạy. `setup:env` tạo `.env` ở root/service và `.env.local` của hai frontend, giữ nguyên file đã tồn tại. **Hai lệnh tạo key/secret chỉ cần cho lần chuẩn bị đầu**; script RSA sẽ từ chối ghi đè nếu key đã có.

Giữ cấu hình local mặc định để dùng nguyên lệnh trong tài liệu. Nếu đổi cổng/tài khoản DB, phải sửa đồng bộ URL trong `services/*/.env` và `docker-compose.apps.yml`; Compose backend hiện ghi trực tiếp tài khoản dev `toeic:toeic`.

## 3. Bật hạ tầng và khôi phục dữ liệu bàn giao

Hướng dẫn chính chạy **backend trong Docker, Web/CMS trên host**. Cách này chỉ cần hai terminal FE, đồng thời FE gọi Gateway qua `127.0.0.1` đúng cấu hình hiện tại.

```powershell
docker compose up -d --wait --wait-timeout 180 postgres redis rabbitmq minio elasticsearch mailpit
if ($LASTEXITCODE -ne 0) { throw 'Hạ tầng chưa sẵn sàng; xem docker compose ps và logs' }
```

PostgreSQL tự tạo các DB khi volume được khởi tạo lần đầu. Chép gói nhận được vào `private/handoff/`, với cấu trúc:

```text
private/handoff/
  auth_db.dump
  question_db.dump
  exam_db.dump
  learning_db.dump
  analytics_db.dump
  toeic-media/          # bên trong giữ nguyên cây object key
  toeic-user/           # nếu có avatar
  source-commit.txt
```

**Chỉ restore theo cách dưới trên database mới, chưa chạy migrations/backend và chưa có dữ liệu riêng.** Nếu máy đã có dữ liệu, xuất backup của máy đó trước và chọn môi trường mới; không trộn hai bộ DB. Lệnh restore không có `--clean` và sẽ dừng nếu gặp xung đột.

```powershell
$ErrorActionPreference = 'Stop'
$backup = Join-Path (Get-Location).Path 'private/handoff'
foreach ($dbName in @('auth_db', 'question_db', 'exam_db', 'learning_db', 'analytics_db')) {
    if (-not (Test-Path -LiteralPath "$backup/$dbName.dump")) { throw "Thiếu $dbName.dump" }
}
if (-not (Test-Path -LiteralPath "$backup/toeic-media")) { throw 'Thiếu thư mục media' }

foreach ($dbName in @('auth_db', 'question_db', 'exam_db', 'learning_db', 'analytics_db')) {
    docker compose cp "$backup/$dbName.dump" "postgres:/tmp/$dbName.dump"
    if ($LASTEXITCODE -ne 0) { throw "Chép backup thất bại: $dbName" }
    docker compose exec -T postgres pg_restore -U toeic -d $dbName --no-owner --no-acl --exit-on-error --single-transaction "/tmp/$dbName.dump"
    if ($LASTEXITCODE -ne 0) { throw "Restore thất bại: $dbName; dừng và xem lỗi, không chạy tiếp" }
}

docker compose exec -T minio sh -c 'mkdir -p /tmp/toeic-handoff'
if ($LASTEXITCODE -ne 0) { throw 'Không tạo được thư mục nhận media' }
foreach ($bucketName in @('toeic-media', 'toeic-user')) {
    if (Test-Path -LiteralPath "$backup/$bucketName") {
        docker compose exec -T minio mc mb --ignore-existing "local/$bucketName"
        if ($LASTEXITCODE -ne 0) { throw "Không tạo được bucket $bucketName" }
        docker compose cp "$backup/$bucketName" minio:/tmp/toeic-handoff/
        if ($LASTEXITCODE -ne 0) { throw "Chép media thất bại: $bucketName" }
        docker compose exec -T minio mc mirror "/tmp/toeic-handoff/$bucketName" "local/$bucketName"
        if ($LASTEXITCODE -ne 0) { throw "Restore media thất bại: $bucketName" }
    }
}
```

Giữ đúng bucket/key và địa chỉ local media `http://localhost:19000/toeic-media`. Việc restore không đổi URL media đã lưu trong DB; nếu máy nguồn dùng hostname/cổng/bucket khác, cần thống nhất lại cấu hình và dữ liệu trước khi sử dụng.

Nếu **không nhận gói dữ liệu**, bỏ qua toàn bộ lệnh restore, tiếp tục mục 4, tạo tài khoản ở mục 6 rồi nhập nội dung thủ công qua CMS ở mục 8. Database mới khi đó chưa có đề ETS, từ vựng, bài học hay tiến độ.

## 4. Chạy backend và kiểm tra database

```powershell
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d --build --wait --wait-timeout 600 api-gateway
if ($LASTEXITCODE -ne 0) { throw 'Backend chưa sẵn sàng; xem logs trước khi làm tiếp' }
Invoke-RestMethod http://localhost:3000/api/v1/ready
```

Mong đợi `status: ready`. Compose tự chạy migrations cho cả 5 DB, tạo bucket media/public GET cho bucket dev `toeic-media`, và bật 6 backend. Job `migrate`/`media-init` kết thúc với mã 0 là bình thường. Bucket avatar `toeic-user` do Auth quản lý, không bật public.

Trên host, generate Prisma client để dùng các script quản trị khi cần; bước này không nhập nội dung và không sửa DB:

```powershell
foreach ($service in @('auth', 'question-bank', 'exam', 'learning', 'analytics')) {
    npm.cmd run prisma:generate -w "@toeic/$service-service"
    if ($LASTEXITCODE -ne 0) { throw "Generate Prisma thất bại: $service" }
}
```

Không chạy `qa:seed`, `prisma migrate reset`, `db push` hay xóa volume để làm đề hiện ra. Các script QA dùng fixture/môi trường riêng, không phải bộ ETS đang bàn giao.

## 5. Bật Web và CMS ở chế độ API thật

Sửa `apps/web/.env.local` thành:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_DATA_MODE=api
FRONTEND_API_ENV=local
FRONTEND_GATEWAY_URL=http://127.0.0.1:3000/api/v1
FRONTEND_TEST_WRITES=enabled
FRONTEND_EXAM_WRITES=enabled
```

Sửa `apps/admin-cms/.env.local` thành:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_DATA_MODE=api
FRONTEND_API_ENV=local
FRONTEND_GATEWAY_URL=http://127.0.0.1:3000/api/v1
FRONTEND_TEST_WRITES=enabled
FRONTEND_METADATA_VERIFIED=false
```

Các cờ ghi ở đây dành cho DB local của máy bạn. `FRONTEND_TEST_WRITES=enabled` cho phép đăng ký, thao tác Learning, profile và CRUD CMS; exam có thêm cờ riêng. `FRONTEND_METADATA_VERIFIED` không chặn màn hình Tests hiện tại.

Mở **hai terminal riêng**, đều ở root repo:

```powershell
# Terminal 1: giữ chạy
npm.cmd run dev -w @toeic/web
```

```powershell
# Terminal 2: giữ chạy
npm.cmd run dev -w @toeic/admin-cms
```

Mở [Web học viên](http://localhost:3006) và [CMS đăng nhập](http://localhost:3007/login). Dùng hostname `localhost` thống nhất khi mở giao diện. Khởi động lại FE sau khi sửa env. Không dùng `npm run dev` ở root để chạy toàn bộ stack: npm chạy các workspace tuần tự và sẽ dừng chờ ở server đầu tiên.

Không dùng `npm run apps:up` cùng lúc với hai FE trên host vì trùng cổng. Nếu chuyển FE vào Docker, cần cấu hình lại địa chỉ Gateway cho môi trường container; `127.0.0.1` bên trong container không trỏ về backend khác.

## 6. Tài khoản và email kích hoạt

### Học viên

Đăng ký trên Web, mở [Mailpit](http://localhost:8025) lấy thư kích hoạt, bấm link xác nhận rồi đăng nhập. Tài khoản mới có quyền `USER`. Không dùng MailHog cổng 9025 để tìm thư Auth hiện tại.

Nếu đã restore dữ liệu, có thể dùng tài khoản test ACTIVE được người bàn giao gửi riêng. Mỗi máy tạo key riêng nên đăng nhập lại để lấy phiên mới. Thư kích hoạt còn chờ trong backup có thể cần gửi lại vì máy mới dùng khóa mã hóa mail riêng.

### Quản trị nội dung

Ưu tiên tài khoản `CONTENT_ADMIN` đã bàn giao. Nếu dùng DB mới hoặc cần tài khoản local riêng:

```powershell
# Chọn email mới chưa tồn tại trong DB đã restore:
$env:P3_CONTENT_ADMIN_EMAIL = 'content-admin.friend@example.test'
try {
    node scripts/prepare-content-admin.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Không tạo được CONTENT_ADMIN; đọc lỗi, không reset tài khoản cũ' }
} finally {
    Remove-Item Env:P3_CONTENT_ADMIN_EMAIL -ErrorAction SilentlyContinue
}
```

Mở `private/credentials/content-admin-p3.json` để lấy email/mật khẩu sinh tự động rồi đăng nhập CMS. Script chỉ dùng `auth_db` local, tạo tài khoản ACTIVE và không reset tài khoản đã có. Giữ file credentials ở máy mình.

### Quản trị hệ thống

Quản lý user/role/status/audit và reindex cần `SYSTEM_ADMIN`. Nếu DB đã có SYSTEM_ADMIN ACTIVE, dùng tài khoản được bàn giao; script bootstrap sẽ từ chối tạo thêm. Với DB chưa có SYSTEM_ADMIN:

```powershell
$env:ADMIN_BOOTSTRAP_EMAIL = Read-Host 'Email quản trị hệ thống mới'
$adminPassword = Read-Host 'Mật khẩu đủ mạnh theo form đăng ký' -AsSecureString
$env:ADMIN_BOOTSTRAP_PASSWORD = [System.Net.NetworkCredential]::new('', $adminPassword).Password
try {
    node scripts/bootstrap-system-admin.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Bootstrap bị từ chối; kiểm tra đầu vào hoặc tài khoản admin đã tồn tại' }
} finally {
    Remove-Item Env:ADMIN_BOOTSTRAP_EMAIL -ErrorAction SilentlyContinue
    Remove-Item Env:ADMIN_BOOTSTRAP_PASSWORD -ErrorAction SilentlyContinue
}
```

SYSTEM_ADMIN không tự có quyền CONTENT_ADMIN đối với Learning. Có thể dùng hai tài khoản riêng hoặc để SYSTEM_ADMIN cấp thêm quyền cho tài khoản khác qua CMS. Đăng xuất/đăng nhập lại sau khi đổi quyền.

## 7. Lập lại chỉ mục tìm kiếm và kiểm tra sau restore

PostgreSQL đã có câu hỏi nhưng Elasticsearch mới chưa có chỉ mục dữ liệu. Sau khi backend ready, gọi reindex một lần bằng SYSTEM_ADMIN:

```powershell
$systemEmail = Read-Host 'Email SYSTEM_ADMIN'
$systemPassword = Read-Host 'Mật khẩu' -AsSecureString
$loginBody = @{
    email = $systemEmail
    password = [System.Net.NetworkCredential]::new('', $systemPassword).Password
    deviceId = 'local-handoff-reindex'
} | ConvertTo-Json
$session = $null
try {
    $session = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/auth/login -ContentType 'application/json' -Body $loginBody
    $headers = @{ Authorization = "Bearer $($session.accessToken)" }
    Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/questions/reindex -Headers $headers
} finally {
    if ($session) {
        $logoutBody = @{ refreshToken = $session.refreshToken } | ConvertTo-Json
        Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/auth/logout -ContentType 'application/json' -Headers $headers -Body $logoutBody | Out-Null
    }
    $loginBody = $null
    $session = $null
    $headers = $null
}
```

Mong đợi `indexed` lớn hơn 0 nếu đã restore câu hỏi. Chờ một chút rồi tải lại danh sách CMS. Không in hoặc lưu token vào tài liệu/GitHub.

Checklist sử dụng dữ liệu thật:

- CMS thấy **ETS 2023 - Test 01**, 200 câu, thời lượng 7200 giây; ngân hàng có đủ nhóm/câu tương ứng. Nếu dùng đúng snapshot đã nhập ngày 10/11, ID đề là `cd2e4422-1d2c-4b87-a83c-3431d89f74bb`.
- Đăng nhập Web bằng USER, mở `/exam`, chọn đề, bắt đầu Full hoặc luyện Part; thử ảnh Part 1 và audio Part 1–4.
- Chọn đáp án, đợi autosave rồi tải lại để kiểm tra bản nháp; nộp bài để xem kết quả, lời giải và lịch sử. Không chỉnh sửa đề đang dùng chỉ để thử luồng nộp bài.
- Mở từ vựng/ngữ pháp, tạo phiên học/quiz và hoàn thành bài học nếu snapshot có nội dung PUBLISHED. Phiên từ vựng cần ít nhất 5 từ phù hợp và 4 định nghĩa khác nhau; REVIEW chỉ có khi backend thực sự trả về từ đến hạn.
- Xem `/history`, `/analytics`, cập nhật profile; thử quản lý user/role/status/audit bằng SYSTEM_ADMIN nếu đã nhận tài khoản phù hợp.

Thống kê được cập nhật qua sự kiện, có thể cần chờ. Snapshot này không chuyển phiên đăng nhập, Redis cache hay hàng đợi RabbitMQ đang chờ; nên bàn giao sau khi nghiệp vụ hoàn tất và thống kê nguồn đã cập nhật.

## 8. Cách đưa thêm đề/nội dung vào DB qua CMS

### Đề mới

1. Đăng nhập CMS bằng CONTENT_ADMIN, bảo đảm đang ở API mode và đã bật ghi.
2. Tạo câu độc lập cho Part 1/2/5; chọn đúng Part, loại câu, độ khó, lựa chọn, đáp án và lời giải. Part 2 có A–C; các Part khác có A–D.
3. Tạo nhóm cho Part 3/4/6/7, nhập passage/transcript và các câu con theo thứ tự. Thêm nguyên nhóm vào đề để giữ đúng quan hệ và thứ tự câu.
4. Lưu câu/nhóm trước, sau đó upload ảnh/audio từ chính bản ghi đã lưu. Chờ upload và thao tác lưu/đính kèm hoàn tất, mở lại để kiểm tra. Media phải lên MinIO và được gắn key trong DB; chép MP3 vào thư mục source sẽ chưa dùng được.
5. Vào quản lý Tests, tạo đề Full, chọn câu/nhóm và sắp xếp đủ **200 câu**, **7200 giây**, đủ Part 1–7 với 100 Listening/100 Reading. Cấu trúc TOEIC của bộ ETS hiện tại là **6 / 25 / 39 / 30 / 30 / 16 / 54 câu** theo Part 1→7. Backend kiểm tra cấu trúc và nội dung trước khi chấp nhận.
6. Lưu, mở lại đề trong CMS rồi đăng nhập USER bên Web để thử Full/Part. Luyện Part xuất phát từ đề Full có sẵn, không cần tạo loại đề Mini.

### Từ vựng và ngữ pháp

Tạo chủ đề trước, thêm từ vựng kèm định nghĩa/ví dụ; dùng chức năng upload trong bản ghi khi có media. Tạo bài ngữ pháp với tiêu đề, category, Markdown và chuyển sang `PUBLISHED` để học viên sử dụng. Tài khoản CONTENT_ADMIN cần quyền Learning; SYSTEM_ADMIN đơn lẻ chưa đủ.

### Import tự động bộ ETS từ file JSON

Source đã có `scripts/content/import-toeic.cjs` và bộ dữ liệu trong `data/toeic/ets-2023-test-01/`. Có thể kiểm tra offline mà không sửa DB:

```powershell
$checkRun = 'tmp/import-check-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
node scripts/content/import-toeic.cjs --mode validate --batch all --scope exam --out "$checkRun/exam"
if ($LASTEXITCODE -ne 0) { throw 'Dataset Exam chưa hợp lệ; xem report trong thư mục kiểm tra' }
```

**Importer hiện chưa có lệnh bootstrap Full một bước cho máy mới.** Online plan/apply yêu cầu target đã xác minh, credentials, checkpoint của đúng actor/môi trường và bằng chứng nghiệm thu pilot. `verify-local-target.cjs` hiện chỉ xác minh scope Learning; không đủ để apply Exam. Các đường dẫn `tmp/...` trong README lịch sử và checkpoint máy cũ không có trong Git clone.

Vì vậy, để nhận nguyên đề hiện tại hãy dùng snapshot ở mục 1–3, hoặc tạo nội dung mới qua CMS. Nếu phát triển tiếp luồng importer, đọc [README công cụ nhập đề](../scripts/content/README.md) và lập target/evidence riêng cho máy mới; không tự bật cờ acceptance, sao chép manifest máy cũ hay chạy builder/OCR ghi đè dataset đã hoàn thiện. Giữ checkpoint của máy mình để resume, tránh nhập trùng.

## 9. Các chức năng hiện có và giới hạn

| Khu vực       | Có thể sử dụng khi đã chạy API mode và có dữ liệu/quyền                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Auth          | Đăng ký, kích hoạt qua Mailpit, đăng nhập, đăng xuất, khôi phục phiên                                                  |
| Thi/luyện tập | Danh sách/chi tiết đề, Full/Part, đếm giờ theo deadline backend, autosave/resume, nộp bài, kết quả, xem lại và lịch sử |
| Learning      | Chủ đề/từ vựng, flashcard/quiz, lịch ôn theo dữ liệu backend, ngữ pháp và hoàn thành bài                               |
| Analytics     | Dashboard, streak, lịch sử, thống kê/lọc theo khoảng thời gian, dự đoán điểm theo dữ liệu đã có                        |
| Profile       | Sửa thông tin được phép và upload avatar                                                                               |
| CMS nội dung  | CRUD câu hỏi/nhóm/đề, chủ đề/từ vựng/bài học; upload media theo bản ghi                                                |
| CMS hệ thống  | Danh sách user, sửa role/status tài khoản khác, audit; cần SYSTEM_ADMIN                                                |

Giới hạn cần biết: Settings và AI chat chưa sẵn sàng trong API mode; chưa có quản lý/xóa media toàn cục và endpoint chi tiết admin-user riêng. Bộ ETS Full dùng **54 clip theo câu/nhóm**, chưa có một MP3 chạy xuyên suốt toàn đề. Điểm Full dùng bảng tham chiếu mẫu của backend; Part không có điểm TOEIC quy đổi. Việc nhập đủ ETS qua API đã được ghi nhận, nghiệm thu UI toàn bộ bộ đề này vẫn cần kiểm tra trên máy nhận.

## 10. Dùng hằng ngày, pull code mới và xử lý lỗi

### Chạy lại những lần sau

Không restore lại snapshot mỗi lần mở máy:

```powershell
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d --wait --wait-timeout 600 api-gateway
```

Sau đó chạy Web/CMS ở hai terminal như mục 5. Dừng FE bằng `Ctrl+C`, dừng stack và giữ dữ liệu bằng:

```powershell
docker compose -f docker-compose.yml -f docker-compose.apps.yml stop
```

Không dùng `down -v` vì sẽ xóa volume dữ liệu.

### Sau khi pull code mới

Dừng FE, lưu/commit công việc riêng trước khi pull. Không restore lại bộ dump vào DB đang sử dụng.

```powershell
git pull
if ($LASTEXITCODE -ne 0) { throw 'Pull chưa thành công; xử lý thay đổi/conflict trước' }
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'Cài dependency thất bại' }
npm.cmd run setup:env
if ($LASTEXITCODE -ne 0) { throw 'Chuẩn bị env thất bại' }
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d --build --wait --wait-timeout 600 api-gateway
if ($LASTEXITCODE -ne 0) { throw 'Backend chưa sẵn sàng; kiểm tra logs' }
```

Đối chiếu env mẫu để bổ sung biến mới vì `setup:env` giữ file cũ. Generate lại Prisma client trên host nếu dùng script quản trị. Mở lại FE. Không tạo lại RSA key/secret.

### Lỗi thường gặp

| Hiện tượng                               | Cách kiểm tra/xử lý                                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Thấy dữ liệu demo, sửa xong reload mất   | Kiểm tra `NEXT_PUBLIC_DATA_MODE=api` ở đúng `.env.local`, rồi restart FE                                         |
| Báo thao tác ghi bị tắt                  | Kiểm tra `FRONTEND_TEST_WRITES=enabled`; thi còn cần `FRONTEND_EXAM_WRITES=enabled`                              |
| Gateway 503/chưa ready                   | Chạy `ps -a`, đọc logs service và hai job migrate/media-init; không mở FE để suy đoán DB đã sẵn sàng             |
| CMS không thấy câu dù DB có dữ liệu      | Reindex bằng SYSTEM_ADMIN ở mục 7; xác nhận restore đúng `question_db`                                           |
| Ảnh/audio lỗi 403/404                    | Kiểm tra bucket/object đã restore, giữ nguyên key, URL localhost:19000 và policy media-init; avatar không public |
| Đăng nhập được nhưng CMS 403             | Kiểm tra quyền thực từ backend; Learning cần CONTENT_ADMIN, user/audit cần SYSTEM_ADMIN                          |
| Đăng ký xong chưa đăng nhập được         | Kích hoạt trong Mailpit cổng 8025; kiểm tra trạng thái ACTIVE                                                    |
| Cổng đã dùng                             | Dừng đúng tiến trình/stack đang chiếm cổng trước khi khởi động bản mới; không chạy song song hai cách            |
| Không có từ đến hạn/không mở được REVIEW | Lịch ôn do backend quyết định; học NEW trước và chờ ngày đến hạn                                                 |
| Upload trả 429                           | Đợi đúng Retry-After; quota presign hiện là 30 lượt/giờ/actor, không đổi tài khoản để bỏ qua                     |
| Restore báo object/table đã tồn tại      | Dừng restore; DB đích không còn trống hoặc đang dùng nhầm môi trường, không thêm `--clean` tùy tiện              |

Lệnh xem trạng thái/log:

```powershell
docker compose -f docker-compose.yml -f docker-compose.apps.yml ps -a
docker compose -f docker-compose.yml -f docker-compose.apps.yml logs --tail 100 migrate media-init api-gateway auth-service question-bank-service exam-service learning-service analytics-service
```

Các địa chỉ mặc định: Web **3006**, CMS **3007**, Gateway **3000**, PostgreSQL **5432**, Redis **7379**, RabbitMQ **5772** (quản trị **15672**), MinIO API **19000**, Elasticsearch **19200**, Mailpit **8025**. Backend HTTP riêng dùng **3001–3005**, Question Bank gRPC **50052**.

Tham khảo thêm: [backend local](backend-quickstart.md), [Web API mode](../apps/web/README.md), [CMS API mode](../apps/admin-cms/README.md).
