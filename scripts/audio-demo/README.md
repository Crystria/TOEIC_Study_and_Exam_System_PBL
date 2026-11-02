# Tạo audio demo offline trên Windows

Trạng thái 27/10/2026: **đã tạo, tích hợp và kiểm chứng playback Chromium đủ 28 MP3**. Người dùng tạo bằng Windows David/Zira và FFmpeg 9.0.2/libmp3lame; agent kiểm lại checksum, định dạng, giải mã và playback sau khi nhận bản bàn giao. Chưa nghe loa/tai nghe vật lý hoặc xác nhận chất lượng phát âm bằng người nghe. Xem `recordings-20261027/browser-playback-report.json` và lượt 11 trong `docs/frontend-design-review.md`.

MP3 đang dùng nằm tại `apps/web/public/demo/audio/`. Manifest, voice metadata và transcript gốc lúc tạo nằm trong `recordings-20261027/`, ngoài bundle/payload. Hai cờ playback trong manifest gốc được giữ nguyên false để bảo toàn bản ghi lúc tạo; báo cáo browser riêng ghi kết quả mới. Các hướng dẫn dưới đây phục vụ tạo lại. Không chạy lại SAPI/System.Speech trong tài khoản sandbox khi quyền không đổi. Script dành cho terminal Windows của người dùng; không cần Administrator, không đổi execution policy và không gọi dịch vụ speech/network.

## Dependency và lệnh chạy

- Windows, Windows PowerShell 5.1 (`powershell.exe`), .NET Framework `System.Speech`.
- Hai voice English (US) **Microsoft David Desktop** và **Microsoft Zira Desktop** được cài và cho phép sử dụng dưới tài khoản chạy script. Có tên trong registry chưa chứng minh có thể tổng hợp.
- Python **3.9 trở lên**, chỉ standard library, không cần pip.
- FFmpeg và FFprobe trong PATH hoặc truyền đường dẫn tuyệt đối. Mặc định cần encoder `libmp3lame`; có thể dùng `--encoder mp3_mf` nếu bản FFmpeg trên máy chỉ cung cấp encoder đó. Script kiểm tra encoder và giải mã toàn bộ MP3 sau khi tạo; encoder có tên vẫn có thể không chạy được.
- Node/npm của dự án chỉ cần cho kiểm tra mapping với fixture hiện tại.

Chạy tại root repository trong PowerShell hoặc terminal PowerShell của VS Code:

```powershell
Set-Location D:\TOEIC_Study_and_Exam_System_PBL
python scripts/audio-demo/generate.py --check-content
npm run test -w @toeic/web
node scripts/audio-demo/verify-fixtures.cjs
python scripts/audio-demo/generate.py --check-only
python scripts/audio-demo/generate.py
```

Nếu FFmpeg không nằm trong PATH:

```powershell
python scripts/audio-demo/generate.py --ffmpeg 'D:\Tools\ffmpeg\bin\ffmpeg.exe' --ffprobe 'D:\Tools\ffmpeg\bin\ffprobe.exe' --encoder libmp3lame
```

`--check-only` chỉ kiểm tra dependency/voice/encoder, **không** chứng minh tạo giọng thành công. Nếu policy chặn script, voice không dùng được hoặc có `E_ACCESSDENIED`, dừng và giữ nguyên lỗi; không bypass policy, nâng quyền hoặc tự tải phần mềm. Chỉ chạy lại sau khi điều kiện thay đổi. Không thêm dependency hay khóa API vào frontend.

## Nội dung, nguồn và mapping dự kiến

`content.json` là transcript tự soạn cho demo, bao gồm từ/câu ví dụ gốc đang có trong fixture của dự án; không lấy bản ghi của bên thứ ba. Giọng tạo bởi Windows System.Speech, không phải audio ETS chính thức. Không gán giấy phép Creative Commons cho giọng Microsoft; việc dùng/phân phối giọng phải theo điều khoản của phần mềm/voice đã cài trên máy. Không coi quá trình tạo thành công là xác minh pháp lý quyền phân phối voice. Bản transcript gốc lúc tạo được lưu nguyên byte trong `recordings-20261027/content.json`; content.json hiện tại có cùng đoạn đọc, cập nhật source hash sau khi thêm URL audio.

| Clip dự kiến                     | Nội dung và đối chiếu                                                                                                                               | Phạm vi dùng chung                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `vocabulary-{word}.mp3` (24 tệp) | Đọc đúng từ rồi câu ví dụ hiện có; đầy đủ ba chủ đề, mỗi chủ đề tám từ                                                                              | Mỗi từ một clip riêng, ID trùng fixture; không tái dùng clip không liên quan |
| `listening-part-1.mp3`           | A: màn hình trên bàn; B: phụ nữ viết sổ; C: hai người cạnh cửa sổ; D: đàn ông tưới cây. Khớp `office.svg`: màn hình/sổ/cây trên bàn, không có người | Full test: 6 nhóm; tất cả đề demo: 12 nhóm                                   |
| `listening-part-2.mp3`           | Hỏi giờ bắt đầu họp, đọc A–D khớp chính xác bốn lựa chọn hiện tại                                                                                   | Full test: 25 nhóm; tất cả đề: 60 nhóm                                       |
| `listening-part-3.mp3`           | Hội thoại hai giọng về giao máy in cho văn phòng, ngày mai buổi chiều, liên hệ nhà cung cấp                                                         | Full test: 13 nhóm/39 câu; tất cả đề: 29 nhóm                                |
| `listening-part-4.mp3`           | Thông báo cho nhân viên mới, phòng đào tạo tầng ba, mang employee ID                                                                                | Full test: 10 nhóm/30 câu; tất cả đề: 20 nhóm                                |

Tổng cộng **28 clip dự kiến**, phủ 24 từ và 54 nhóm Listening của đề full, 121 nhóm Listening trên toàn bộ bốn đề. Các nhóm trong cùng Part hiện lặp cùng template, nên dùng chung đúng clip Part; đây chưa phải 121 nội dung nghe khác nhau. JSON liệt kê từng `fixtureIds`, `publicUrl`, speaker/đoạn đọc và SHA-256 source để phát hiện fixture/hình thay đổi trước khi tạo. Không đổi số phương án Part 2: Word SRS/CSDL mô tả bốn; backend DTO chưa bắt buộc đúng bốn hoặc audio theo Part, media dùng `mediaUrl` thay vì `audio_key`. Cần chốt contract riêng.

## Đầu ra và bước tích hợp sau khi tạo thành công

Mỗi lần chạy tạo thư mục **mới** `tmp/demo-audio-generated-...`, không ghi đè tệp cũ. Có WAV trung gian, MP3 mono 44.1 kHz/96 kbps, `voice-info.json` và `manifest.json`. Chỉ ghi manifest thành công khi đủ 28 tệp qua kiểm tra codec MP3, duration hữu hạn 0.3–180 giây, dung lượng tối đa **5.000.000 byte**, decode toàn bộ không lỗi và không im lặng. Manifest ghi byte size, duration, SHA-256, RMS, mapping, voice/metadata, System.Speech assembly/Windows/FFmpeg/FFprobe, rate -1, volume 100, khoảng nghỉ 550 ms và timestamp. Kiểm tra RMS không nhận diện lời nói hay xác nhận phát âm đúng.

1. Nghe từng clip, đối chiếu transcript và phát âm, đặc biệt `refund` là danh từ, `schedule` theo IPA Mỹ. Chưa có ASR hoặc người nghe xác nhận chất lượng. Nếu sai, sửa cách đọc trước khi tích hợp; không gán clip sai từ.
2. Sau khi tệp hợp lệ: đặt **chỉ MP3** vào `apps/web/public/demo/audio/`, đúng basename trong `content.json`. Giữ WAV, manifest, voice-info, transcript và script ngoài public/bundle/payload.
3. Sửa tối thiểu mapping `audioUrl` của `src/lib/learning/mock-data.ts` theo word ID và của `src/lib/exams/question-fixtures.ts` theo Part 1–4; Part 5–7 vẫn null. Dùng lại AudioPlayer/VocabularyAudio/ExamMedia/repository hiện tại. Không đổi `EXAM_CONTENT_VERSION`, ID câu, mode, Part, duration hoặc deadline để thêm media; giữ phiên cũ có thể resume.
4. Gắn nhãn hiển thị **giọng tổng hợp, nội dung minh họa, không phải ETS** ở adapter/UI. Không import JSON transcript vào frontend; không đưa transcript/answer key/explanation vào question set hoặc Attempt.
5. Chạy QA dưới browser context riêng, tạo phiên mới qua UI nếu cần, không ghi đè localStorage của người dùng. Kiểm tra metadata/duration, playing/currentTime tăng, pause/resume/replay, seeking/seeked, rate 0.8/1.2, ended; delay request để kiểm tra loading, lỗi tải lần đầu rồi retry cùng URL MP3 thành công; thiếu media riêng. Không dispatch sự kiện media giả.
6. Kiểm tra không autoplay, dừng luồng đang phát khi đổi từ/câu cùng nhóm/nhóm khác/rời trang/unmount; đáp án và deadline nguyên vẹn sau nghe/reload. Chụp đúng viewport desktop/tablet/mobile, đo ảnh thực tế và tràn ngang; Tab/Space/seek/focus/labels. Ghi riêng nghe loa/tai nghe vật lý và playback browser; không coi hai việc là một.

Script **không publish hoặc sửa source/phiên**. Nếu bị lỗi giữa chừng, đầu ra dở dang vẫn ở tmp để chẩn đoán; không copy vào public và không tính là hoàn thành. `physicalListeningVerified` và `browserPlaybackVerified` trong manifest luôn false khi tạo, vì phải có vòng QA tiếp theo. Các file này không làm thay đổi backend, Dashboard/Analytics, streak, Settings, Profile, Learning progress, Attempt hoặc quota.
