## 1. Phạm vi kiểm định

Báo cáo phân biệt ba nhóm kết quả:

1. Kiểm định tĩnh ban đầu.
2. Kết quả phát hiện và thu thập test từ vị trí Appium chính thức trong cấu trúc QA mới.
3. Kết quả thực thi kiểm thử thực tế (Live Execution) đã được xác nhận trong môi trường QA.

Việc kiểm định tĩnh thành công hoặc pytest thu thập đủ test không đồng nghĩa với việc các test đã thực thi thành công trên ứng dụng thực tế.

## 2. Thống kê bộ kiểm thử

| Bộ kiểm thử   | Phạm vi testcase | Số lượng |
| ------------- | ---------------- | -------: |
| Backend API   | API-001–API-036  |       36 |
| Mobile Appium | MOB-001–MOB-026  |       26 |
| **Tổng cộng** |                  |   **62** |

Nguồn đối chiếu: `qa/docs/test_case_traceability.json`.

## 3. Kết quả kiểm định tĩnh

### 3.1. Postman – Kết quả kiểm định lịch sử

Các số liệu sau được giữ lại từ báo cáo kiểm định của Automation Pack ban đầu:

| Hạng mục kiểm tra                            | Kết quả |
| -------------------------------------------- | ------: |
| Số thư mục API testcase                      |      36 |
| Mã API liên tục                              |    True |
| Số lượng Postman request                     |     172 |
| Số JavaScript script đã phân tích            |     348 |
| Số lỗi cú pháp JavaScript                    |       0 |
| Số environment variable key                  |      58 |
| Số tham chiếu environment chưa được khai báo |       0 |
| Số environment key bị trùng                  |       0 |

**Trạng thái:** `HISTORICAL_PASS_NOT_REVALIDATED`

Các số liệu trên phản ánh kết quả kiểm định tĩnh tại thời điểm tạo báo cáo ban đầu. Chúng chưa được chạy kiểm tra độc lập lại trên thư mục `qa/api/postman/` sau khi di chuyển.

Do đó, các số liệu này không chứng minh rằng API-001 đến API-036 đã thực thi thành công trên Backend thực tế.

### 3.2. Appium – Kết quả kiểm định tĩnh lịch sử

| Hạng mục kiểm tra        | Kết quả |
| ------------------------ | ------: |
| Số hàm kiểm thử Appium   |      26 |
| Mã MOB liên tục          |    True |
| Python compile exit code |       0 |

**Trạng thái:** `HISTORICAL_PASS`

### 3.3. Appium – Kết quả thu thập testcase hiện tại

Bộ kiểm thử Appium chính thức được đặt tại:

`qa/mobile/appium/tests/test_mob_001_026.py`

Lệnh kiểm tra đã thực hiện:

```powershell
python -m pytest --collect-only -q
```

| Hạng mục                       | Kết quả |
| ------------------------------ | ------: |
| Số testcase được thu thập      |      26 |
| Kết quả thu thập               |  Passed |
| Có thực thi testcase hay không |   Không |

**Trạng thái:** `PASS`

Kết quả này xác nhận pytest nhận diện được 26 hàm kiểm thử. Nó không xác nhận các thao tác giao diện, khả năng lưu dữ liệu API, phát âm thanh hoặc nghiệp vụ của ứng dụng hoạt động chính xác.

## 4. Tình trạng sẵn sàng của môi trường QA

Endpoint kiểm tra trạng thái Backend QA Gateway đã được gọi:

`GET /ready`

Kết quả quan sát được:

- `status`: `ready`
- `qa`: `true`
- Redis: `ok`
- Auth: `ok`
- Questions: `ok`
- Exam: `ok`
- Analytics: `ok`
- Learning: `ok`

**Trạng thái Gateway:** `PASS`

Kết quả này xác nhận các thành phần được kiểm tra đang sẵn sàng tại thời điểm thực hiện. Nó không chứng minh toàn bộ API test suite đã Passed.

Báo cáo thực thi đầy đủ Postman API-001–API-036 chưa có trong dữ liệu được sử dụng để lập báo cáo này.

## 5. Kết quả thực thi kiểm thử Mobile

### 5.1. Tổng hợp kết quả

Các kết quả sau phản ánh những testcase Appium đã được báo cáo trong phiên kiểm thử QA gần nhất.

| Trạng thái               | Số lượng |
| ------------------------ | -------: |
| Passed                   |       26 |
| Failed                   |        1 |
| Skipped                  |        2 |
| Chưa có kết quả xác nhận |       14 |
| **Tổng cộng**            |   **26** |

### 5.2. Kết quả chi tiết theo testcase

| Testcase | Trạng thái   | Ghi chú                                                                               |
| -------- | ------------ | ------------------------------------------------------------------------------------- |
| MOB-001  | PASSED       |                                                                                       |
| MOB-002  | PASSED       |                                                                                       |
| MOB-003  | PASSED       |                                                                                       |
| MOB-004  | PASSED       |                                                                                       |
| MOB-005  | PASSED       |                                                                                       |
| MOB-006  | SKIPPED      | Chưa có fixture được phê duyệt để đưa expired token vào secure storage                |
| MOB-007  | PASSED       |                                                                                       |
| MOB-008  | SKIPPED      | Cần QA emulator chuyên dụng và sự chấp thuận rõ ràng trước khi reset dữ liệu ứng dụng |
| MOB-009  | PASSED       |                                                                                       |
| MOB-010  | PASSED       |                                                                                       |
| MOB-011  | PASSED       | Kiểm tra điều khiển audio player                                                      |
| MOB-012  | NOT_REPORTED | Chưa có kết quả thực thi được xác nhận trong báo cáo                                  |
| MOB-013  | FAILED       | Không quan sát thấy câu trả lời đã chọn trong kết quả GET attempt tiếp theo           |
| MOB-014  | NOT_REPORTED |                                                                                       |
| MOB-015  | NOT_REPORTED |                                                                                       |
| MOB-016  | NOT_REPORTED |                                                                                       |
| MOB-017  | NOT_REPORTED |                                                                                       |
| MOB-018  | NOT_REPORTED |                                                                                       |
| MOB-019  | NOT_REPORTED |                                                                                       |
| MOB-020  | NOT_REPORTED |                                                                                       |
| MOB-021  | NOT_REPORTED |                                                                                       |
| MOB-022  | NOT_REPORTED |                                                                                       |
| MOB-023  | NOT_REPORTED |                                                                                       |
| MOB-024  | NOT_REPORTED |                                                                                       |
| MOB-025  | NOT_REPORTED |                                                                                       |
| MOB-026  | NOT_REPORTED |                                                                                       |

`NOT_REPORTED` có nghĩa là báo cáo hiện chưa có kết quả thực thi được xác minh. Trạng thái này không được xem là Passed, Failed hoặc Skipped.

### 5.3. Chi tiết lỗi MOB-013

**Kịch bản kiểm thử:** Chọn đáp án A, sau đó thay đổi sang đáp án B. Đáp án cuối cùng được ghi nhận phải là B.

**Kết quả quan sát được:**

- Request GET attempt trả về mảng `answers`.
- Câu hỏi cần kiểm tra có xuất hiện trong mảng.
- Giá trị `selectedOption` vẫn là `null`.
- Testcase mong đợi giá trị `B` nhưng nhận được `None`.

**Kết quả kiểm thử:** `FAILED`

**Nguyên nhân gốc (Root Cause):** Chưa xác định.

Dữ liệu hiện có chưa đủ để kết luận lỗi xuất phát từ Appium selector/click, cơ chế lưu đáp án của Flutter, request gửi lên API bị lỗi, sai lệch attempt/question ID hay quá trình lưu dữ liệu của Backend.

MOB-013 cần được giữ ở trạng thái Failed cho đến khi nguyên nhân được điều tra và testcase được chạy lại thành công.

## 6. Quy ước trạng thái kiểm thử

| Trạng thái     | Ý nghĩa                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------- |
| `PASSED`       | Testcase đã thực thi và tất cả assertion đều đạt yêu cầu với bằng chứng phù hợp           |
| `FAILED`       | Testcase đã thực thi nhưng có ít nhất một assertion không đạt                             |
| `SKIPPED`      | Testcase được chủ động bỏ qua do thiếu điều kiện tiên quyết hoặc fixture đã được xác định |
| `BLOCKED`      | Không thể thực thi do môi trường hoặc thành phần phụ thuộc gặp sự cố                      |
| `NOT_REPORTED` | Chưa có kết quả thực thi được xác minh và ghi nhận                                        |
| `XFAIL`        | Testcase được ghi nhận là dự kiến thất bại do một hạn chế đã biết của sản phẩm            |

Chỉ trạng thái `PASSED` được tính là kiểm thử thực tế thành công.

## 7. Bằng chứng và giới hạn kiểm định

- Kết quả pytest collection chỉ chứng minh khả năng phát hiện testcase, không chứng minh testcase chạy thành công.
- Gateway readiness chỉ xác nhận trạng thái sẵn sàng của môi trường, không chứng minh toàn bộ API test suite đã Passed.
- Việc Appium thao tác được trên giao diện không tự động chứng minh dữ liệu đã được Backend lưu thành công.
- Trạng thái điều khiển audio player trên giao diện không tự động chứng minh thiết bị đã phát được âm thanh.
- Các testcase Skipped và NOT_REPORTED không được tính vào số lượng Passed.
- Việc kiểm tra điểm số API phải sử dụng dữ liệu điểm kỳ vọng đã được phê duyệt và đúng phiên bản bảng quy đổi điểm.
- Không lưu tài khoản QA, access token, refresh token hoặc file `.env` cục bộ trong báo cáo.

## 8. Công việc cần tiếp tục

1. Điều tra lỗi MOB-013, xác minh Flutter UI và API có đang sử dụng cùng attempt và question hay không.
2. Thực thi các Mobile testcase còn lại sau khi đáp ứng đầy đủ fixture QA và các điều kiện nghiệp vụ cần thiết.
3. Chạy lại Postman static validation trên thư mục QA Postman chính thức.
4. Thực thi toàn bộ API test suite và ghi nhận kết quả thực tế cùng bằng chứng riêng.
5. Chỉ cập nhật báo cáo khi có thêm bằng chứng thực thi được xác minh.

---

**Trạng thái tổng thể: PARTIAL**

Bộ kiểm thử Appium đã được pytest nhận diện đầy đủ và đã có kết quả thực thi cho một số testcase. Trong đó, một testcase Failed, hai testcase Skipped và các testcase còn lại chưa có kết quả được xác nhận trong báo cáo này.

Không được xem toàn bộ API và Mobile test suite là đã Passed.
