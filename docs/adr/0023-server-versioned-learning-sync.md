# ADR 0023 Đồng bộ tiến độ bằng server version và entity revision

- Ngày: 2026-10-31.
- Trạng thái: Accepted cho thiết kế P0; triển khai ở P2/P3/P4.
- Nguồn: SRS FK-04/UC-03, CSDL user_sync_states và lựa chọn giữ tiến độ server mới hơn khi xung đột.

## Chủ sở hữu

Learning sở hữu progress và entity revision; Auth sở hữu sync admission/order và projection canonical. Không ghi chéo DB. Auth không chấp nhận EF, interval, quizScore, điểm thi, role hoặc arbitrary state từ client. Client gửi thao tác để Learning tự tính.

`syncVersion` là accepted sequence của Auth, bắt đầu `0`; `resolvedVersion` là watermark liên tiếp đã APPLIED hoặc REJECTED; `appliedVersion` là version APPLIED lớn nhất đã có kết quả, có thể thấp hơn resolvedVersion. Device cursor không làm khóa phân xử toàn user. Mỗi progress entity có revision bắt đầu `0` khi chưa có hàng, tăng một lần mỗi thao tác mới commit. Tất cả số này là BIGINT không âm và JSON decimal string ≤ 9223372036854775807; cạn miền trả 503 và cảnh báo, không wrap.

## Admission ở Auth

1. JWT xác định user, body có deviceId, operationId, baseVersion, clientOccurredAt và một operation. Bản đầu chỉ một operation/user đang PENDING; session submit được coi là một operation nhiều item nguyên tử. Giới hạn body 256 KiB.
2. Auth normalize payload theo contract và hash canonical JSON (key order ổn định); scope `(userId, operationId)` áp dụng chung với Learning. Kiểm tra replay trước mọi version/time check: cùng key/hash trả bản ghi trạng thái hiện tại, khác hash trả 409 `IDEMPOTENCY_CONFLICT`.
3. Lock head. Base nhỏ hơn head trả 200 `accepted=false,status=CONFLICT` cùng head/canonical hiện có; base lớn hơn head trả 400 `FUTURE_VERSION`. Head có pending khác thì trả 200 `accepted=false,status=BUSY`, không cấp version. Base đúng và không pending thì cấp head+1 và ghi pending + outbox cùng transaction.
4. Trả 200 `accepted=true,status=PENDING`, operation/version và watermark. Canonical lúc này chỉ là projection đã biết, có thể chưa phản ánh hoạt động online vừa commit tại Learning; response có projectedAt/entity revisions. Client không được hiện “đã đồng bộ” trước APPLIED.
5. `GET /sync/users/me` trả head/watermarks, pending operation và trang projection tối đa 50 entity có sort ổn định; không trả toàn bộ progress không giới hạn. `GET /sync/operations/{operationId}` trả kết quả operation của chính user; 404 nếu không thuộc user.

## Apply ở Learning

Chấp nhận ba operation kind: REVIEW_FLASHCARD (quality, vocabularyId, baseEntityRevision), COMPLETE_LESSON (lessonId, baseEntityRevision), SUBMIT_VOCABULARY_SESSION (sessionId, năm reviews và năm answers; expected revisions từ snapshot server). Offline chỉ submit session đã tạo online và chưa hết hạn; không tự tạo quiz client-side.

Learning có inbox transport và ledger `(user_id, operation_id)` dùng chung REST trực tiếp/sync. Nếu operation đã commit cùng hash, không chạy lại SM-2 hay activity event; chỉ tạo/kết xuất event kết quả cho request sync nếu chưa có. Hash khác là REJECTED/IDEMPOTENCY_CONFLICT. Không đưa baseVersion/device vào hash thao tác chung vì cùng thao tác có thể đi qua REST hoặc sync.

Trong transaction, lock progress theo thứ tự entity type/ID ổn định, kiểm tra quyền/nội dung/revision, áp dụng toàn bộ hoặc không item nào, tăng revision, ghi ledger/inbox và outbox. Completion đã tồn tại trả trạng thái hiện tại, không đổi completedAt hoặc phát lại lesson event; operation mới với base revision cũ vẫn bị conflict trước bước này.

Online action cũng require operationId và baseEntityRevision (hoặc session snapshot); khi offline command đang pending vẫn có thể online commit. Nếu online thắng trước, sync bị REJECTED/ENTITY_REVISION_CONFLICT và trả snapshot server. Nếu sync thắng trước, online revision cũ nhận 409. Quyết định theo commit/revision server, không theo đồng hồ client và không merge SM-2.

Validation lỗi nghiệp vụ (entity deleted, session expired, revision conflict) ghi terminal REJECTED và event kết quả; lỗi hạ tầng rollback và retry, không kết luận rejected. Hỏng schema trước khi biết user/operation phải vào DLQ và operator khôi phục từ outbox, không bỏ pending bằng cách tự áp dụng payload không rõ nghĩa.

## Phản hồi và hội tụ

`LearningSyncResolvedEvent.v2` có user/operation/syncVersion, APPLIED hoặc REJECTED, reason và snapshot progress đúng revision. `LearningProgressChangedEvent.v2` phát cho mọi online/sync commit progress mới. Hai event có thể tới sai thứ tự.

Auth inbox + update terminal status + watermark trong một transaction. Chỉ merge snapshot khi revision lớn hơn projection; revision bằng mà nội dung khác phải quarantine/cảnh báo, không ghi đè. Snapshot cũ không lùi projection. Callback terminal cho cùng operation phải cùng result/hash; khác result là lỗi đối soát.

Watermark chỉ đi qua operation đã resolved liên tiếp, kể cả rejected; không đánh APPLIED cho rejected. Pending sau 30 giây báo chậm và tiếp tục theo dõi/retry, không cấp lại version hoặc tự coi thành công. Reconciliation nội bộ truy vấn operation ledger của Learning bằng API service-auth; thiếu kết quả thì replay đúng original event ID/operation, không tạo command mới.

Projection repair/bootstrap dùng API nội bộ Learning có cursor, không đọc Learning DB từ Auth. Không emit command khi tiêu thụ progress/result, tránh vòng lặp Auth → Learning → Auth. Sau bootstrap trả revision watermark của Learning; client muốn dữ liệu mới tức thời vẫn đọc Learning API.

## Clock và offline

Online activityAt do server đặt. Sync clientOccurredAt chỉ được dùng làm activityAt khi nằm trong 30 ngày trước acceptedAt và không quá 5 phút tương lai; trong 5 phút tương lai clamp về acceptedAt, quá biên trả 400. Đồng hồ client không quyết định revision. Ngày ôn/streak dùng activityAt giờ Việt Nam, nên review offline cũ có thể đã đến hạn ngay khi sync. Session phải được nộp trước expiresAt theo giờ server, không dùng clientOccurredAt để lách hạn.

Ledger/idempotency giữ ít nhất 90 ngày; client không tự replay command quá cửa sổ offline bằng ID mới. Ngày đầu entity revision=0; thiếu progress phải phân biệt với entity nội dung không tồn tại. Các fixture state machine ở P0 minh họa xung đột/replay/out-of-order; test transaction/race thật thuộc P4.
