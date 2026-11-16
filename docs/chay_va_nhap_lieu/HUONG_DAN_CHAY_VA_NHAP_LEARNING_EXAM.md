# Hướng dẫn chạy dự án và nhập Learning, đề ETS trên máy khác

Đối chiếu code ngày **16/11/2026**. Dành cho Windows PowerShell, Node.js **22** theo `.nvmrc`, npm 10+, Docker Desktop Linux containers và Compose 2.22+. Chạy mọi lệnh tại **root repository**; dùng `npm.cmd` thay cho `npm.ps1`.

Hướng dẫn hỗ trợ hai cách chạy backend:

| Nội dung                                              | A — Backend terminal | B — Backend Docker       |
| ----------------------------------------------------- | -------------------- | ------------------------ |
| PostgreSQL/MinIO/Redis/RabbitMQ/Elasticsearch/Mailpit | Docker               | Docker                   |
| Auth/Question Bank/Exam/Learning/Analytics/Gateway    | 6 terminal trên host | Compose apps overlay     |
| Script kiểm tra và nhập dữ liệu                       | Node trên host       | **Vẫn Node trên host**   |
| Web/CMS nếu cần sử dụng                               | Host                 | Host trong hướng dẫn này |

Mục tiêu là nhập **5 chủ đề, 100 từ, 5 bài ngữ pháp** và **ETS 2023 - Test 01: 200 câu, 42 nhóm, 1 đề Full, 54 MP3 + 11 ảnh**. Nghiệm thu bằng API/DB, không bắt buộc UI. Trạng thái xuất bản bài học và trải nghiệm giao diện cần kiểm tra riêng nếu đưa cho học viên sử dụng.

## 1. Chọn đúng tình huống trước khi bắt đầu

| Máy nhận đang có gì?                                         | Cách xử lý                                                                                                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DB mới/chỉ có tài khoản, chưa có nội dung Learning/Exam      | Dùng toàn bộ luồng JSON bên dưới                                                                                                                                   |
| Đã nhập một phần bằng chính checkpoint của máy đó            | Resume cùng actor/target/checkpoint; đọc mục 13                                                                                                                    |
| Đã có dữ liệu khác hoặc dataset đã nhập nhưng mất checkpoint | Backup và đối soát trước; không tạo checkpoint trắng rồi apply                                                                                                     |
| Có gói bàn giao 5 DB + MinIO và muốn nhận nguyên trạng       | Dùng nhánh restore trong [tài liệu bàn giao](../HUONG_DAN_CHAY_DU_AN_VA_NHAP_DE.md), vào DB mới trước migrations/backend; không tiếp tục import JSON cùng nội dung |

**Luồng lệnh mẫu dưới đây dành cho catalog Learning/Exam ban đầu trống.** Guard Learning hiện so snapshot catalog với đúng ID pilot (1 chủ đề, 20 từ, 1 bài); nếu có nội dung khác, kể cả nội dung xóa mềm còn trong DB, không thể áp dụng nguyên xi. Cần môi trường dữ liệu riêng hoặc điều chỉnh công cụ có kiểm thử theo phạm vi mới, không sửa evidence/cờ để bỏ qua.

Git chuyển code, không chuyển PostgreSQL/MinIO, `.env`, `secrets/`, credentials, checkpoint hoặc report local. Không lấy ID đề, tên thư mục có timestamp, actorId hay target của người khác để dùng trên máy mới.

## 2. Nhận code, dependency, env và khóa local

Lấy đúng commit chứa các công cụ mới. Kiểm tra tồn tại:

```powershell
$required = @(
    'scripts/content/import-toeic.cjs',
    'scripts/content/verify-local-target.cjs',
    'scripts/content/verify-exam-target.cjs',
    'scripts/content/learning-api-db-acceptance.cjs',
    'scripts/content/exam-api-db-acceptance.cjs',
    'scripts/content/inspect-test1-runtime.ps1',
    'scripts/content/inspect-test1-host.cjs',
    'data/toeic/ets-2023-test-01/dataset.json'
)
foreach ($file in $required) {
    if (-not (Test-Path -LiteralPath $file)) { throw "Thiếu file: $file; nhận đúng phiên bản code trước" }
}
node --version
npm.cmd --version
docker compose version
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'Cài dependency thất bại' }
npm.cmd run setup:env
if ($LASTEXITCODE -ne 0) { throw 'Tạo env thất bại' }
```

Người bàn giao phải gửi đủ các file media được dataset tham chiếu, không chỉ `dataset.json`. Validate sau đó sẽ kiểm tra file/hash. Không chạy builder/OCR để ghi đè dataset đã hoàn thiện.

`setup:env` giữ nguyên file đã có; sau pull phải tự đối chiếu env mẫu. Mở PowerShell mới dành riêng đợt nhập, tránh các biến `DATABASE_URL`, `PORT`, `MINIO_*`, `TOEIC_IMPORT_*` còn sót từ môi trường QA hoặc tác vụ khác.

Trên máy mới, tạo khóa riêng **một lần**:

```powershell
if ((Test-Path secrets/jwt-access-public.pem) -or (Test-Path secrets/jwt-access-private.pem)) {
    if (-not ((Test-Path secrets/jwt-access-public.pem) -and (Test-Path secrets/jwt-access-private.pem))) {
        throw 'Cặp RSA key không đầy đủ; xử lý trước, không ghi đè tùy tiện'
    }
    Write-Host 'Giữ nguyên cặp RSA key hiện có'
} else {
    node scripts/generate-access-keys.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Tạo RSA key thất bại' }
}
node scripts/generate-auth-secrets.mjs
if ($LASTEXITCODE -ne 0) { throw 'Chuẩn bị Auth secrets thất bại' }
```

Không sao chép private key của máy bàn giao. Script Auth secrets giữ file đã có. Không tạo lại key mỗi lần khởi động.

### Cấu hình chuẩn cho bộ lệnh trong tài liệu

| Thành phần host | Giá trị mặc định                                                   |
| --------------- | ------------------------------------------------------------------ |
| Gateway         | `http://127.0.0.1:3000/api/v1`                                     |
| PostgreSQL      | `localhost:5432`, user dev `toeic`                                 |
| DB              | `auth_db`, `question_db`, `exam_db`, `learning_db`, `analytics_db` |
| Redis           | `localhost:7379`                                                   |
| RabbitMQ        | `localhost:5772`                                                   |
| Elasticsearch   | `http://localhost:19200`                                           |
| MinIO           | `http://localhost:19000`, bucket `toeic-media`                     |
| Mailpit         | `http://localhost:8025`                                            |

Giữ `.env` của service trên host trỏ `localhost` kể cả khi chọn cách B: verifier, Prisma và script tạo admin chạy trên host. Compose đặt endpoint nội bộ `postgres`, `minio`, `redis` qua `environment` riêng của container.

**Giới hạn portability của code hiện tại:** verifier dùng Gateway cố định `127.0.0.1:3000`; importer chỉ chấp nhận Gateway loopback `/api/v1`; script tạo admin chỉ chấp nhận local DB tên `auth_db`; Compose backend ghi trực tiếp nhiều URL dev và cổng. Không chỉ đổi `.env` root rồi cho rằng mọi thành phần tự đồng bộ. Nếu máy khác không dùng được các giá trị mặc định, cần đồng bộ service env, Compose, các script verifier và kiểm tra lại trước nhập. Hướng dẫn này không dành cho server remote/production hoặc gọi trực tiếp từ máy khác qua IP LAN.

## 3. Bật hạ tầng và chọn đúng một cách chạy backend

```powershell
docker compose up -d --wait --wait-timeout 180 postgres redis rabbitmq minio elasticsearch mailpit
if ($LASTEXITCODE -ne 0) { throw 'Hạ tầng chưa ready; xem docker compose ps/logs' }
```

PostgreSQL init script chỉ tạo DB khi khởi tạo volume lần đầu. Nếu volume cũ thiếu DB thì kiểm tra trước, không xóa volume để làm lại.

### Cách A — Hạ tầng Docker, backend terminal

Đảm bảo các container backend của cách B đã dừng trước khi chạy Node trên host:

```powershell
docker compose -f docker-compose.yml -f docker-compose.apps.yml stop api-gateway auth-service question-bank-service exam-service learning-service analytics-service
if ($LASTEXITCODE -ne 0) { throw 'Chưa dừng được backend Docker' }
npm.cmd run build -w @toeic/common
if ($LASTEXITCODE -ne 0) { throw 'Build Common thất bại' }

foreach ($service in @('auth', 'question-bank', 'exam', 'learning', 'analytics')) {
    npm.cmd run prisma:generate -w "@toeic/$service-service"
    if ($LASTEXITCODE -ne 0) { throw "Generate Prisma thất bại: $service" }
    npm.cmd run prisma:deploy -w "@toeic/$service-service"
    if ($LASTEXITCODE -ne 0) { throw "Migration thất bại: $service" }
}
npm.cmd exec -w @toeic/learning-service -- tsc --noEmit -p tsconfig.build.json
if ($LASTEXITCODE -ne 0) { throw 'Learning chưa biên dịch được' }
```

Migrations thay đổi schema DB; với DB đã sử dụng phải backup trước bước này theo mục 5. Không đặt `DATABASE_URL` chung cho vòng lặp. Lỗi thiếu `PersonalVocabulary*`/`PersonalGrammarLesson` trong TypeScript thường cần generate lại client; generate không tạo bảng DB.

Chuẩn bị media public cho cả Learning **và Exam** trên local mặc định:

```powershell
$env:NODE_ENV = 'development'
$env:MINIO_PUBLIC_READ = 'true'
try {
    node scripts/init-media.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Chuẩn bị bucket media thất bại' }
} finally {
    Remove-Item Env:MINIO_PUBLIC_READ -ErrorAction SilentlyContinue
    Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
}
```

`init-media.mjs` đọc **process env**, không tự đọc file `.env`. Với cấu hình mặc định, giá trị fallback đúng `localhost:19000`, `toeic-media`, credentials MinIO dev. Nếu đã đổi endpoint/bucket/credentials, phải cấp đúng `MINIO_ENDPOINT`, `MINIO_BUCKET`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` qua process env, không in secret ra log. Script bật public GET toàn bucket media cho dev; không dùng cho production, không áp dụng lên bucket avatar `toeic-user`. Chỉ chạy `init-learning-media.mjs` chưa đủ cho media Exam vì policy đó nhắm prefix Learning.

Mở **6 terminal riêng**, mỗi terminal ở root repo, giữ chạy:

| Thứ tự | Lệnh                                                    |
| ------ | ------------------------------------------------------- |
| 1      | `npm.cmd run start:dev -w @toeic/auth-service`          |
| 2      | `npm.cmd run start:dev -w @toeic/question-bank-service` |
| 3      | `npm.cmd run start:dev -w @toeic/exam-service`          |
| 4      | `npm.cmd run start:dev -w @toeic/learning-service`      |
| 5      | `npm.cmd run start:dev -w @toeic/analytics-service`     |
| 6      | `npm.cmd run start:dev -w @toeic/api-gateway`           |

### Cách B — Hạ tầng và backend Docker

Dừng cả 6 service host bằng `Ctrl+C` nếu đã chạy cách A. Sau đó:

```powershell
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d --build --wait --wait-timeout 600 api-gateway
if ($LASTEXITCODE -ne 0) { throw 'Backend Docker chưa ready; xem logs migrate/media-init/service' }
```

Compose tự chạy migrations 5 DB, job media-init và 6 backend. `migrate`/`media-init` kết thúc exit 0 là bình thường. Chỉ định `api-gateway` không khởi động Web/CMS.

**Vẫn generate client trên host** để chạy verifier và script quản trị:

```powershell
foreach ($service in @('auth', 'question-bank', 'exam', 'learning', 'analytics')) {
    npm.cmd run prisma:generate -w "@toeic/$service-service"
    if ($LASTEXITCODE -ne 0) { throw "Generate Prisma host thất bại: $service" }
}
```

Không sửa host `.env` thành `postgres:5432`/`minio:9000` chỉ vì backend chạy container. Script host phải truy cập cổng published. Đối chiếu DB name/bucket trong Compose và host env; không xác nhận target nếu hai phía khác nhau. Sau khi sửa source Gateway/quota, `up --build` để image nạp code mới; restart container cũ không bảo đảm chứa source mới nếu chưa sync/build.

## 4. Kiểm tra readiness và runtime

```powershell
Invoke-RestMethod http://localhost:3000/ready
```

Cần `status=ready`, tất cả checks `ok`, `qa=False`. **Gateway dùng `/ready`**, không phải `/api/v1/ready` (đường dẫn đó có thể trả 401). Backend riêng dùng `/api/v1/ready` ở cổng 3001–3005.

Chọn một lệnh tương ứng:

```powershell
# Cách A
.\scripts\content\inspect-test1-runtime.ps1 -Mode host
# HOẶC cách B
.\scripts\content\inspect-test1-runtime.ps1 -Mode docker
```

Script ghi báo cáo mới dưới `tmp/`, không restart/migrate/ghi DB. Host mode có thể cảnh báo chưa xác minh listener PID dù HTTP đã ready; báo cáo đánh dấu `listener.verified=false`. Không diễn giải cảnh báo thành service đã hỏng hoặc đã xác minh process. Nếu tìm được process khác Node hoặc nhiều PID xung đột thì dừng xử lý. `.env` chưa chứng minh môi trường thực của process; không dùng shell override trỏ DB test mà không cập nhật/đối chiếu.

Nếu PowerShell chặn `.ps1`, không tự đổi Execution Policy để vượt chặn; dùng terminal/chính sách được phép của máy nhận hoặc đối chiếu thủ công, giữ rõ phần chưa xác minh.

## 5. Backup trước mọi thay đổi vào DB hiện có

Với DB đang dùng, làm phần này **trước migrations hoặc nhập liệu**. Với máy mới, có thể backup sau khi schema/media được khởi tạo. Dừng Web/CMS và nghiệp vụ; chờ hàng đợi/thống kê cập nhật. Cách A: `Ctrl+C` từng backend terminal; cách B:

```powershell
docker compose -f docker-compose.yml -f docker-compose.apps.yml stop api-gateway auth-service question-bank-service exam-service learning-service analytics-service
```

Giữ PostgreSQL và MinIO chạy. Mẫu sau dùng user PostgreSQL dev `toeic`; nếu đổi user thì sửa đúng:

```powershell
$ErrorActionPreference = 'Stop'
$backup = Join-Path (Get-Location).Path ('private/backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
New-Item -ItemType Directory -Path $backup | Out-Null
foreach ($dbName in @('auth_db', 'question_db', 'exam_db', 'learning_db', 'analytics_db')) {
    docker compose exec -T postgres pg_dump -U toeic -d $dbName -Fc --no-owner --no-acl -f "/tmp/$dbName.dump"
    if ($LASTEXITCODE -ne 0) { throw "Dump thất bại: $dbName" }
    docker compose cp "postgres:/tmp/$dbName.dump" "$backup/$dbName.dump"
    if ($LASTEXITCODE -ne 0) { throw "Chép dump thất bại: $dbName" }
    docker compose exec -T postgres pg_restore --list "/tmp/$dbName.dump" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Dump không đọc được danh mục: $dbName" }
}

# Liệt kê bucket để phân biệt bucket chưa có với lỗi quyền/kết nối.
$bucketLines = @(docker compose exec -T minio mc ls --json local)
if ($LASTEXITCODE -ne 0) { throw 'Không liệt kê được bucket MinIO' }
$bucketNames = @($bucketLines | Where-Object { $_.Trim() } | ForEach-Object {
    $entry = $_ | ConvertFrom-Json
    if ($entry.status -ne 'success') { throw 'MinIO trả lỗi khi liệt kê bucket' }
    if ($entry.type -eq 'folder') { $entry.key.TrimEnd('/') }
})
$mediaStage = '/tmp/handoff-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
foreach ($bucketName in $bucketNames) {
    # Tạo trước để bucket 0 object vẫn backup được.
    docker compose exec -T minio mkdir -p "$mediaStage/$bucketName"
    if ($LASTEXITCODE -ne 0) { throw "mkdir thất bại: $bucketName" }
    docker compose exec -T minio mc mirror "local/$bucketName" "$mediaStage/$bucketName"
    if ($LASTEXITCODE -ne 0) { throw "Mirror thất bại: $bucketName" }
    docker compose cp "minio:$mediaStage/$bucketName" "$backup/$bucketName"
    if ($LASTEXITCODE -ne 0) { throw "Chép media thất bại: $bucketName" }
}
$bucketNames | ConvertTo-Json | Set-Content -Encoding utf8 "$backup/buckets.json"
git rev-parse HEAD | Set-Content -Encoding utf8 "$backup/source-commit.txt"
Get-ChildItem -LiteralPath $backup
```

Mẫu backup tất cả bucket được liệt kê, gồm cả bucket test nếu có. Alias `local` là alias của image MinIO hiện dùng; nếu đổi image/alias, phải sửa lệnh. Không dùng `>` để ghi dump nhị phân. Kiểm tra danh mục chưa thay cho thử restore. Nếu chưa tạo đủ DB thì xử lý đúng tình trạng, không tiếp tục với bản backup thiếu mà gọi là hoàn chỉnh.

Khởi động lại backend theo cách đã chọn ở mục 3 trước khi chạy verifier/importer. Không restore dump này lên DB hiện tại để tiếp tục nhập.

## 6. Chuẩn bị account riêng của máy nhận

Với DB mới hoặc chưa có account tương ứng:

```powershell
node scripts/prepare-content-admin.mjs
if ($LASTEXITCODE -ne 0) { throw 'Chuẩn bị CONTENT_ADMIN thất bại; không reset account cũ' }
```

Mặc định tạo `content-admin.p3@example.test`, ACTIVE + CONTENT_ADMIN; credentials tại `private/credentials/content-admin-p3.json`. Có thể đặt `P3_CONTENT_ADMIN_EMAIL` trước khi chạy nếu cần email khác. Script chỉ dùng local `auth_db`; nếu tài khoản hoặc file credentials đã có mà không khớp, nó dừng, không reset/ghi đè. Không xóa file credentials chỉ để chạy lại.

Không dùng tài khoản/mật khẩu của máy khác. Nếu dùng account CONTENT_ADMIN có sẵn, tạo file credentials local riêng gồm `email` và `password`, giữ riêng ngoài Git, rồi thay biến `$credentials` ở dưới. SYSTEM_ADMIN đơn lẻ chưa đáp ứng importer vì login kiểm tra CONTENT_ADMIN.

Importer ưu tiên đủ cặp `TOEIC_IMPORT_EMAIL/PASSWORD` hơn `--credentials`; mở shell nhập riêng và không để hai biến này tồn tại ngoài các block verifier. Verifier đăng nhập/đăng xuất, có thể ghi dữ liệu phiên/audit; không tạo nội dung Learning/Exam.

## 7. Tạo phiên nhập mới, validate và xác minh target

Chỉ tạo phiên **mới trên máy mới/catalog trống**. Nếu đang resume, vào mục 13, không tạo checkpoint khác.

```powershell
$ErrorActionPreference = 'Stop'
$run = 'private/imports/ets-2023-test-01-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
New-Item -ItemType Directory -Path $run | Out-Null
$state = "$run/import-state.local.json"
$credentials = 'private/credentials/content-admin-p3.json'

# Không chứa secret; dùng để khôi phục biến khi mở terminal mới.
[ordered]@{ run=$run; state=$state; credentials=$credentials } |
    ConvertTo-Json | Set-Content -Encoding utf8 "$run/session.json"
Write-Host "Giữ đường dẫn phiên nhập: $run"

node scripts/content/import-toeic.cjs --mode validate --batch all --scope learning --out "$run/validate-learning"
if ($LASTEXITCODE -ne 0) { throw 'Learning validate thất bại' }
node scripts/content/import-toeic.cjs --mode validate --batch all --scope exam --out "$run/validate-exam"
if ($LASTEXITCODE -ne 0) { throw 'Exam validate thất bại' }
```

Mong đợi Learning 5/100/5; Exam 200/42/1; `valid=true`, `errors=[]`. Không dùng bộ nguồn khác chỉ vì cùng tên file. Không nâng Prisma major theo thông báo CLI trong lúc nhập.

Định nghĩa hàm verifier dùng lại trong cùng terminal:

```powershell
function Invoke-LocalTargetCheck {
    param([Parameter(Mandatory=$true)][string]$OutputDirectory)
    $account = Get-Content -LiteralPath $credentials -Raw | ConvertFrom-Json
    $env:TOEIC_IMPORT_EMAIL = $account.email
    $env:TOEIC_IMPORT_PASSWORD = $account.password
    try {
        node scripts/content/verify-local-target.cjs $OutputDirectory --exam
        if ($LASTEXITCODE -ne 0) { throw 'Xác minh target thất bại; chưa nhập' }
    } finally {
        Remove-Item Env:TOEIC_IMPORT_EMAIL -ErrorAction SilentlyContinue
        Remove-Item Env:TOEIC_IMPORT_PASSWORD -ErrorAction SilentlyContinue
        Remove-Variable account -ErrorAction SilentlyContinue
    }
}
Invoke-LocalTargetCheck "$run/target-initial"
$target = "$run/target-initial/target.json"
```

Hàm này dùng file `{email,password}` chuẩn; nếu credentials của bạn dạng wrapper `accounts.content_admin`, cần trích đúng object trước khi đặt biến (importer tự hỗ trợ wrapper, block PowerShell này chưa hỗ trợ).

Mong đợi `verifiedScopes=[learning,exam]`, bucket tồn tại, catalog Learning/Exam ban đầu đều 0. Cả hai cách A/B đều chạy verifier trên host. Catalog Questions dùng chỉ mục tìm kiếm; nếu DB/API mismatch phải đối chiếu runtime/index, không đổi scope bằng tay.

## 8. Learning pilot: plan → apply → reimport

```powershell
$learningArgs = @(
    'scripts/content/import-toeic.cjs', '--scope', 'learning',
    '--target', $target, '--credentials', $credentials,
    '--state', $state, '--wait-rate-limits'
)
node @learningArgs --mode plan --batch pilot --out "$run/learning-pilot-plan"
if ($LASTEXITCODE -ne 0) { throw 'Learning pilot plan thất bại' }
```

Chỉ khi plan đúng **1 chủ đề/20 từ/1 bài, add=22/update=0/same=0** mới chạy:

```powershell
node @learningArgs --mode apply --batch pilot --out "$run/learning-pilot-apply"
if ($LASTEXITCODE -ne 0) { throw 'Pilot apply chưa hoàn tất; giữ checkpoint' }
node @learningArgs --mode apply --batch pilot --out "$run/learning-pilot-reimport"
if ($LASTEXITCODE -ne 0) { throw 'Pilot reimport chưa đạt' }
```

Apply mong đợi 22 add; reimport **0 add/0 update/22 same**. Nếu có update hoặc add khi reimport, dừng đối soát, không coi exit 0 là đủ.

## 9. Learning: bằng chứng API/DB và mở rộng Full

Tạo đúng cấu trúc evidence mà guard đọc:

```powershell
$learningEvidence = "$run/learning-api-db"
node @learningArgs --mode plan --batch pilot --out "$learningEvidence/api-readback"
if ($LASTEXITCODE -ne 0) { throw 'Learning API readback thất bại' }
Invoke-LocalTargetCheck "$learningEvidence/db-api"
```

Đọc lại phải 0 add/0 update/22 same. Verifier phải có topics=1/words=20/lessons=1, `databaseAndApiMatch=true`; ID catalog khớp checkpoint. Giữ snapshot này nguyên trạng, **không tạo lại bằng catalog Full sau nhập rồi thay evidence pilot**.

```powershell
$fullLearningArgs = $learningArgs + @(
    '--batch', 'all',
    '--learning-api-db-evidence', $learningEvidence,
    '--learning-reimport-report', "$run/learning-pilot-reimport/report.json"
)
node @fullLearningArgs --mode plan --out "$run/learning-full-plan"
if ($LASTEXITCODE -ne 0) { throw 'Full Learning plan chưa đạt' }
```

Cần `acceptancePath=learning-api-db`, `livePilotReadback=passed`, summary **88 add/0 update/22 same**. Guard kiểm tra report/target/mappings, rồi GET lại pilot bằng cùng actor. Không đặt `learningPilot/ui=true` bằng tay.

```powershell
node @fullLearningArgs --mode apply --out "$run/learning-full-apply"
if ($LASTEXITCODE -ne 0) { throw 'Full Learning apply chưa hoàn tất' }
node @fullLearningArgs --mode apply --out "$run/learning-full-reimport"
if ($LASTEXITCODE -ne 0) { throw 'Full Learning reimport chưa đạt' }
```

Apply mong đợi 88 add/0 update/22 same; reimport **0 add/0 update/110 same**.

```powershell
docker compose exec -T postgres psql -U toeic -d learning_db -c "SELECT 'topics' AS content, COUNT(*) FROM vocabulary_topics WHERE deleted_at IS NULL UNION ALL SELECT 'words', COUNT(*) FROM vocabularies WHERE deleted_at IS NULL UNION ALL SELECT 'lessons', COUNT(*) FROM grammar_lessons WHERE deleted_at IS NULL;"
if ($LASTEXITCODE -ne 0) { throw 'Kiểm tra Learning DB thất bại' }
```

Kết quả cần **5/100/5**. Đây là nhập nội dung, không tạo tiến độ học hoặc bảo đảm mọi bài đã PUBLISHED. Không chạy `accept-learning-pilot.cjs` lịch sử cho luồng này: script đó dùng account lịch sử và có thao tác học/quiz, không phải chỉ đọc DB.

## 10. Exam: xác minh lại target và pilot

Sau Learning có thể backup thêm snapshot mới. Nếu dừng backend để backup thì chạy lại đúng cách đã chọn, kiểm tra Gateway ready rồi tiếp tục.

```powershell
Invoke-LocalTargetCheck "$run/target-before-exam"
$examTarget = "$run/target-before-exam/target.json"
$examArgs = @(
    'scripts/content/import-toeic.cjs', '--scope', 'exam',
    '--target', $examTarget, '--credentials', $credentials,
    '--state', $state, '--wait-rate-limits'
)
node @examArgs --mode plan --batch pilot --out "$run/exam-pilot-plan"
if ($LASTEXITCODE -ne 0) { throw 'Exam pilot plan thất bại' }
```

Verifier lúc này cần Learning vẫn 5/100/5, Exam 0/0/0 và bucket tồn tại. Target mới phải cùng identity Gateway/DB/bucket với checkpoint; `verifiedAt` mới không gây đổi identity. Nếu báo khác môi trường thì dừng, không sửa state.

Pilot plan cần **20 câu/4 nhóm/0 đề, 9 add/0 update/0 same**. Summary đếm **5 câu độc lập + 4 nhóm**, không đếm riêng 15 câu con.

```powershell
node @examArgs --mode apply --batch pilot --out "$run/exam-pilot-apply"
if ($LASTEXITCODE -ne 0) { throw 'Exam pilot apply chưa hoàn tất' }
node @examArgs --mode apply --batch pilot --out "$run/exam-pilot-reimport"
if ($LASTEXITCODE -ne 0) { throw 'Exam pilot reimport chưa đạt' }
```

Apply cần 9 add/0 update; reimport **0 add/0 update/9 same**. Pilot upload/attach 7 media: 4 MP3, 3 PNG.

## 11. Exam Full: nghiệm thu pilot, plan, apply, reimport

```powershell
$fullExamArgs = $examArgs + @(
    '--batch', 'all',
    '--exam-pilot-reimport-report', "$run/exam-pilot-reimport/report.json"
)
node @fullExamArgs --mode plan --out "$run/exam-full-plan"
if ($LASTEXITCODE -ne 0) { throw 'Full Exam plan chưa đạt' }
```

Guard yêu cầu target scope Exam và report pilot reimport; sau login cùng actor sẽ GET lại pilot/câu con, kiểm tra media đã gắn, tải public 7 media pilot để đối chiếu MIME và SHA-256 với nguồn/checkpoint. Không cần nghiệm thu UI và không dùng cờ `--api-only` lịch sử.

Kết quả cần:

- `counts`: 200 câu/42 nhóm/1 đề.
- `acceptancePath=exam-api-db`, `livePilotReadback=passed`, `publicMediaHashMatches=true`.
- Summary **95 add/0 update/9 same** khi chỉ có pilot.

Plan có thể ghi nhận Test phụ thuộc các ID câu sẽ được tạo khi apply; không tạo đề thiếu câu hoặc ID giả.

```powershell
node @fullExamArgs --mode apply --out "$run/exam-full-apply"
if ($LASTEXITCODE -ne 0) { throw 'Full Exam apply chưa hoàn tất; giữ checkpoint' }
node @fullExamArgs --mode apply --out "$run/exam-full-reimport"
if ($LASTEXITCODE -ne 0) { throw 'Full Exam reimport chưa đạt' }
```

Apply cần 95 add/0 update/9 same; reimport **0 add/0 update/104 same**. Tổng cấp trên: 61 câu độc lập + 42 nhóm + 1 đề = 104. Đề có 200 câu, 7200 giây; **ID đề được sinh mới trên từng máy**, không dùng ID trong biên bản máy bàn giao.

### Quota media hiện tại

Trong `services/api-gateway/src/gateway/route-policy.ts`, presign capacity **200 lượt/tài khoản**, refill **200 lượt/giờ** (1 lượt/18 giây). Đây là token bucket dùng chung theo user, không reset đồng loạt mỗi giờ. Hết quota trả 429 `RATE_LIMITED` + `Retry-After`. Các biến env rate limit đọc thông thường không đổi quota presign ghi trong code.

Importer đã có `--wait-rate-limits`, chờ theo header, chia mỗi lần sleep tối đa 60 giây; tổng budget quota chờ mặc định 3 giờ. Không đổi actor, xóa Redis hoặc upload trực tiếp bằng storage credentials để bỏ qua API. Token quota cũ không tự reset khi đổi code/restart; capacity 200 không bảo đảm ngay lập tức có sẵn 200 lượt. Luồng này không tự nâng giới hạn: kiểm tra đúng code/commit và Gateway đã nạp code mới.

## 12. Kiểm tra hoàn tất, media và backup sau nhập

Truy vấn chỉ đọc (user `toeic` mặc định):

```powershell
docker compose exec -T postgres psql -U toeic -d question_db -c "SELECT 'questions' AS content, COUNT(*) FROM questions WHERE deleted_at IS NULL UNION ALL SELECT 'groups', COUNT(*) FROM question_groups WHERE deleted_at IS NULL;"
if ($LASTEXITCODE -ne 0) { throw 'Đếm Question Bank thất bại' }
docker compose exec -T postgres psql -U toeic -d question_db -c "SELECT part, COUNT(*) FROM questions WHERE deleted_at IS NULL GROUP BY part ORDER BY part;"
if ($LASTEXITCODE -ne 0) { throw 'Đếm Part thất bại' }
docker compose exec -T postgres psql -U toeic -d exam_db -c "SELECT t.test_id, t.test_title, t.duration_seconds, COUNT(q.question_id) AS question_count FROM tests t LEFT JOIN test_questions q ON q.test_id=t.test_id WHERE t.deleted_at IS NULL GROUP BY t.test_id, t.test_title, t.duration_seconds;"
if ($LASTEXITCODE -ne 0) { throw 'Kiểm tra đề thất bại' }
```

| Kiểm tra          | Kết quả cần trên DB nội dung mới               |
| ----------------- | ---------------------------------------------- |
| Learning          | 5 chủ đề, 100 từ, 5 bài                        |
| Question Bank     | 200 câu, 42 nhóm                               |
| Part 1→7          | 6 / 25 / 39 / 30 / 30 / 16 / 54                |
| Test              | ETS 2023 - Test 01, 7200 giây, 200 quan hệ câu |
| Learning reimport | 0 add/0 update/110 same                        |
| Exam reimport     | 0 add/0 update/104 same                        |

Chạy lại lệnh đếm Learning ở mục 9 sau Exam. Giữ report chứng minh từng bước; đếm DB không thay thế so nội dung qua API.

**Giới hạn media:** Full dataset có 65 media, importer upload/attach/readback khi apply. Cờ `publicMediaHashMatches` trong `examAcceptance` chỉ chứng minh **7 media pilot**, không phải public hash toàn bộ 65. Nếu muốn nghiệm thu đầy đủ, cần tải public từng media theo mapping checkpoint và so MIME/SHA-256 với dataset, lưu report riêng; không tuyên bố đã kiểm tra đủ khi chưa chạy. Đề dùng clip theo câu/nhóm, chưa có một MP3 phát xuyên suốt đề.

Nếu tìm kiếm CMS thiếu dữ liệu dù DB có câu, xem index Elasticsearch và reindex bằng SYSTEM_ADMIN theo [mục 7 tài liệu bàn giao](../HUONG_DAN_CHAY_DU_AN_VA_NHAP_DE.md#7-lập-lại-chỉ-mục-tìm-kiếm-và-kiểm-tra-sau-restore). Không nhập lại để làm mới index. `CONTENT_ADMIN` dùng import không thay cho SYSTEM_ADMIN ở thao tác reindex.

Tạo **backup mới** theo mục 5 sau khi nghiệp vụ hoàn tất và thống kê cập nhật. Giữ bản trước nhập. Kèm code commit, dataset, cả thư mục `$run`, báo cáo runtime ở `tmp/`, DB dump và MinIO. File baseline có thể chứa dữ liệu tiến độ; mọi tài liệu local/backup/credentials phải chia sẻ riêng, không đưa lên Git công khai. Không commit mật khẩu/token/private key.

## 13. Mở terminal mới, resume và các lỗi thường gặp

### Khôi phục biến khi mở shell mới

Không đoán hoặc lấy thư mục mới nhất tự động. Chọn đúng `session.json` của máy/đợt nhập đang tiếp tục:

```powershell
$sessionFile = Read-Host 'Đường dẫn session.json của đợt nhập cần tiếp tục'
$session = Get-Content -LiteralPath $sessionFile -Raw | ConvertFrom-Json
$run = $session.run
$state = $session.state
$credentials = $session.credentials
$target = "$run/target-initial/target.json"
$learningEvidence = "$run/learning-api-db"
$examTarget = "$run/target-before-exam/target.json"
```

Định nghĩa lại mảng `$learningArgs`, `$fullLearningArgs`, `$examArgs`, `$fullExamArgs` và hàm verifier từ đúng mục cần chạy. Không chạy lại phần tạo `$run`/checkpoint mới. Chỉ chọn target đã tồn tại và đã xác minh; chưa đến bước Exam thì không dùng đường dẫn Exam chưa tạo.

Khi lỗi apply, dùng cùng actor/target/state và output mới có timestamp sau khi đã đối soát thao tác chưa rõ kết quả. Summary resume có thể khác lần đầu vì một số record đã tạo. Không thêm record bằng tay để đạt đúng số dự kiến. Thay máy/DB/actor là môi trường mới, không mặc nhiên resume checkpoint cũ. Khi chuyển cả DB+checkpoint sang máy khác, cần xác minh lại target/identity và đường dẫn evidence, không sửa JSON để buộc khớp.

| Hiện tượng                                     | Cách xử lý                                                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/api/v1/ready` Gateway trả 401                | Dùng `/ready` tại Gateway                                                                                  |
| TypeScript thiếu `PersonalVocabulary*`         | Generate Learning client, chạy `tsc --noEmit`; restart watch nếu cần                                       |
| Runtime báo thiếu bảng                         | Kiểm tra migrations đúng DB; generate client không tạo schema                                              |
| `Checkpoint belongs to another dataset/target` | Dừng đối chiếu Gateway/DB/bucket/dataset, không sửa state                                                  |
| `Checkpoint actor differs`                     | Dùng đúng account của đợt nhập; không đổi actor để né quota                                                |
| Output/report đã tồn tại                       | Chọn `--out` mới, giữ checkpoint                                                                           |
| Có `.lock`                                     | Xác minh tiến trình nhập đã dừng; không xóa lock khi importer còn chạy; lưu bằng chứng trước xử lý lock cũ |
| 429                                            | Để `--wait-rate-limits` chờ Retry-After; nếu hết budget thì resume đúng checkpoint sau                     |
| 403/404 public media                           | Kiểm tra bucket/key/policy; host mode cần init-media public GET cho Exam                                   |
| DB/API catalog lệch                            | Kiểm tra runtime DB và Elasticsearch; không tự cấp scope                                                   |
| Snapshot Learning pilot có count khác 1/20/1   | Đang trộn catalog hoặc dùng snapshot sai giai đoạn; không ghi đè evidence pilot bằng Full                  |
| Existing account/file credentials không khớp   | Đối soát account/file, không reset/xóa credentials cũ tùy tiện                                             |
| Docker backend chưa nhận code mới              | Build lại overlay; không chỉ restart image cũ                                                              |

Không chạy `qa:seed`, `prisma migrate reset`, `db push`, `down -v` để làm dữ liệu xuất hiện. Không cần tạo thêm đề Mini: luyện Part dùng đề Full có sẵn.

## 14. Web/CMS tùy chọn và sử dụng hằng ngày

Không bắt buộc mở giao diện để import. Nếu muốn dùng, cả hai cách A/B đều chạy FE trên host trong hướng dẫn này. Đặt trong `.env.local` của Web và CMS:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_DATA_MODE=api
FRONTEND_API_ENV=local
FRONTEND_GATEWAY_URL=http://127.0.0.1:3000/api/v1
FRONTEND_TEST_WRITES=enabled
```

Web thêm `FRONTEND_EXAM_WRITES=enabled`; CMS có thể dùng `FRONTEND_METADATA_VERIFIED=false` theo cấu hình hiện tại. Restart FE sau đổi env. Mở hai terminal riêng:

```powershell
npm.cmd run dev -w @toeic/web
```

```powershell
npm.cmd run dev -w @toeic/admin-cms
```

Mở `http://localhost:3006` và `http://localhost:3007/login`. Không chạy thêm FE container hoặc root `npm run dev` để khởi động tất cả workspace. Chuyển FE vào Docker cần sửa Gateway URL phía server, vì `127.0.0.1` trong container không phải Gateway container khác; không thuộc hai cấu hình mẫu ở đây.

Ngày sau chỉ bật hạ tầng và backend theo mục 3, không import/restore lại. Dừng bằng `Ctrl+C` ở terminal và `docker compose stop` hoặc Compose overlay `stop`, giữ volume. Sau pull code: backup nếu cần, `npm.cmd ci`, đối chiếu env mẫu, generate client và deploy migrations đúng cách chạy, rebuild Common hoặc Docker image; giữ key/secret cũ.
