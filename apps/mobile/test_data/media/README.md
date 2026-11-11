# Media fixtures – giới hạn baseline

Không kèm audio/image giả để tránh tạo bằng chứng sai.

Theo `MockTestTakingMockData.buildBank()` trong app(3).zip:
- Part 1 có `imageDescription` nhưng không có `imageUrl`/ảnh thật.
- Part 2 có option text rỗng và comment nêu transcript/audio chưa có.
- Part 3–4 question groups không có `audioUrl`/transcript.
- Appium smoke test phát hiện `_AudioPromptCard` hiển thị “Trình phát chưa được kết nối trong bản mock”.

Vì vậy MOB-011 chưa thể kiểm thử phát audio; MOB-012 chỉ kiểm tra resume app, không kết luận được chính sách audio background. Dữ liệu này cần team/backend cung cấp file audio được cấp quyền sử dụng, manifest mapping question/group -> asset, expected duration và transcript dùng cho đối soát. Không tải/nhúng audio ETS có bản quyền nếu team không có quyền sử dụng.
