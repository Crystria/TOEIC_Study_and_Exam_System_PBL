# ADR 0021 Phạm vi và xác thực cho Auth Learning Analytics

- Ngày: 2026-10-31.
- Trạng thái: Accepted cho thiết kế P0; chưa triển khai runtime.
- Nguồn: SRS §3.1/3.4/3.5, CSDL §5.2, kế hoạch `private/plan/auth-learning-analytics-development-plan.md` và lựa chọn của người dùng trong chat.
- Bổ sung ADR 0010; không dùng câu “User Service chỉ giữ profile” để loại bỏ các nghiệp vụ Auth đã có trong SRS.

## Quyết định

1. Bản đầu gồm Auth email, Learning, sync và Analytics. OAuth, xóa tài khoản liên service, CDC và triển khai production nằm ngoài P0–P6.
2. Chọn Full/Part theo ADR 0019: Full có điểm tham khảo từ bảng quy đổi của Exam; Part chỉ accuracy, kể cả chọn 7 Part. Analytics chỉ dự đoán/score trend từ Full đủ dữ liệu. Không tự chuyển Mini legacy thành Part hay coi raw correct count là điểm TOEIC.
3. JSON REST dùng camelCase, DB snake_case, version BIGINT truyền chuỗi thập phân. Không đổi contract legacy đang chạy trong P0. Các contract mới được đánh dấu target, không phản ánh API đã triển khai.
4. Account mới INACTIVE + USER, BCrypt cost 12; kích hoạt email mới login. Access JWT 15 phút; refresh UUIDv4 opaque 7 ngày, chỉ hash SHA-256 được lưu. Rotation atomic; user status/roles luôn đọc lại khi refresh.
5. Chọn RS256 cho access JWT; Auth giữ private key, Gateway/service chỉ giữ public key/JWKS được cấu hình nội bộ. Require `iss=toeic-auth`, `aud=toeic-api`, `type=access`, `sub`, `roles`, `sid`, `sessionVersion`, `userVersion`, `iat`, `exp`, `jti`; không tự tải key từ URL trong token. Issuer/audience có cấu hình bắt buộc và phải đồng nhất toàn môi trường.
6. Session và user authorization version được kiểm tra ở service (Gateway có thể chặn sớm). Khi logout, suspend hoặc đổi roles, cập nhật version/revocation trong Auth DB và invalidation qua outbox. Service cache tối đa 30 giây, sau đó phải revalidate với API nội bộ Auth có xác thực service và timeout 1 giây. Không có dữ liệu đủ mới và Auth/Redis lỗi thì trả 503, không fail-open. SLA thu hồi ≤ 30 giây khi phụ thuộc hoạt động bình thường; refresh kiểm tra DB ngay. Redis chỉ là cache, không là nguồn quyền duy nhất.
7. PUBLIC chỉ register/login/refresh/verify-email/resend-verification và health endpoints đúng method/path. Logout yêu cầu access JWT và refresh của cùng `sid/sub`; không cho thu hồi token của user khác. Không thêm logout-all ở bản đầu.
8. SYSTEM_ADMIN quản lý user/roles/status/audit hệ thống; CONTENT_ADMIN quản lý nội dung Learning; tài khoản chỉ SYSTEM_ADMIN không tự có quyền nội dung. Mọi ACTIVE account có ít nhất một role được đọc nội dung và dùng tác vụ cá nhân. Bảo vệ SYSTEM_ADMIN ACTIVE cuối cùng bằng lock/check trong transaction.
9. Xóa nội dung là soft delete. Giữ DRAFT/PUBLISHED/ARCHIVED như extension cho grammar để bảo toàn dữ liệu cũ: USER chỉ thấy PUBLISHED và chưa deleted; ARCHIVED đồng thời có deletedAt. Topic/vocabulary chỉ cần soft delete. Audit nội dung do Learning sở hữu, không ghi trực tiếp Auth DB.

## Thông số chốt ở P0

Activation TTL 24 giờ, resend tối thiểu 60 giây và tối đa 5 lần/giờ/account; response resend 202 giống nhau với account không tồn tại. Token không dùng lại được; resend vô hiệu token cũ. Password 8–72 byte UTF-8, có chữ hoa/thường ASCII và số; fullName 2–255 ký tự; email trim/lowercase, không xóa dấu chấm hay dấu cộng. Confirm password chỉ so sánh, không lưu.

Avatar private tối đa 2 MiB; vocabulary image 2 MiB, audio 5 MiB; URL PUT/GET private TTL 5 phút. Server sinh key và upload ticket có owner/resource/type/size; confirm kiểm tra HEAD và prefix rồi cập nhật key. Bucket/prefix theo Storage; DB không lưu URL. Idempotency presign 5 phút, confirm/learning operation 90 ngày; operation cũ hơn cửa sổ offline 30 ngày bị từ chối, không tự replay sau khi tombstone bị dọn.

## Hệ quả và kiểm chứng

P1 cần config/key validation, authorization-state interface và messaging; P2 triển khai phiên/activation. P0 chỉ ghi API nội bộ, không thay guard hay secret hiện tại. Kiểm chứng bắt buộc ở P1/P2: refresh race, token sai type/issuer/audience, role cũ, cache hết hạn và fail-closed, last admin race, account INACTIVE/SUSPENDED và activation dùng lại.

Lựa chọn RS256/cache SLA, TTL và byte limit là quyết định thiết kế bổ sung, không phải lời trích từ SRS. Mục tiêu email 5 giây đo tới lúc provider/mail sandbox nhận gửi; inbox thực tế không thuộc bảo đảm đó.
