// Standalone teaching fixtures. Never read Question Bank answers or an active Attempt.
export const chatSuggestions = [
  { topic: 'Từ vựng', icon: 'layers' as const, text: 'Phân biệt “borrow” và “lend” như thế nào?' },
  { topic: 'Ngữ pháp', icon: 'book' as const, text: 'Khi nào dùng hiện tại hoàn thành?' },
  {
    topic: 'Cách học TOEIC',
    icon: 'target' as const,
    text: 'Gợi ý cách luyện nghe TOEIC mỗi ngày.',
  },
];

const vocabulary = `### Phân biệt borrow và lend
**Borrow** là mượn thứ gì từ người khác. **Lend** là cho người khác mượn.

- **Borrow something from someone**: I borrowed a book from Mai.
- **Lend something to someone**: Mai lent a book to me.

Mẹo nhớ: người nhận dùng **borrow**, người đưa dùng **lend**. Cả hai câu trên mô tả cùng một việc từ hai phía.

> Ví dụ học tập riêng, không lấy từ câu hỏi hoặc phiên làm bài của bạn.`;

const grammar = `### Hiện tại hoàn thành
Dùng để nói về trải nghiệm, kết quả liên quan đến hiện tại hoặc việc bắt đầu trong quá khứ và vẫn tiếp diễn.

**Cấu trúc:** \`S + have/has + past participle (V3)\`.

1. Trải nghiệm: I have visited this office before.
2. Kết quả hiện tại: She has finished the report.
3. Việc còn tiếp diễn: We have worked here for two years.

Với mốc thời gian đã kết thúc như **yesterday**, thường dùng quá khứ đơn: She finished the report yesterday.

> Đây là bài giải thích mẫu, không phân tích dữ liệu học tập cá nhân.`;

const study = `### Một buổi luyện nghe ngắn
Bạn có thể thử trình tự sau và điều chỉnh theo thời gian của mình:

1. Nghe một đoạn ngắn, ghi ý chính mà chưa nhìn transcript.
2. Nghe lại và tìm các từ khóa về người, nơi chốn, hành động.
3. Đối chiếu transcript, ghi một vài cụm từ chưa nghe được.
4. Đọc theo một đoạn ngắn rồi nghe lại.

**Giữ nhịp đều đặn** và dành thời gian xem lại lỗi. Bạn có thể dùng thư viện [từ vựng](/study/vocabulary) và [ngữ pháp](/study/grammar) để ôn thêm.

> Đây là gợi ý mẫu chung; không thay đổi mục tiêu, streak hay tiến độ của bạn.`;

const general = `### Cùng bắt đầu từ một chủ đề
Đây là **phản hồi mẫu được soạn sẵn**, không phải kết quả gọi mô hình AI. Bản demo có ba bài minh họa:

- Phân biệt **borrow** và **lend**.
- Cách dùng **hiện tại hoàn thành**.
- Cách luyện **nghe TOEIC** mỗi ngày.

Chọn một gợi ý để xem cách trình bày câu trả lời. Bản demo chưa trả lời riêng cho mọi câu hỏi.`;

export function sampleChatResponse(content: string): string {
  const text = content.toLocaleLowerCase('vi');
  if (/borrow|lend/.test(text)) return vocabulary;
  if (/hiện tại hoàn thành|present perfect/.test(text)) return grammar;
  if (/luyện nghe|listening|cách học|lộ trình/.test(text)) return study;
  return general;
}
