import type { LessonDetailFixture } from './detail-types';

// Original, illustrative CMS-only lesson bodies. Not API records or Markdown payloads.
// Title/category are read from the existing catalog, never guessed from level.
export const LESSON_DETAIL_FIXTURES: readonly LessonDetailFixture[] = [
  {
    id: 'demo-lesson-001',
    body: {
      theory: [
        'Thì hiện tại đơn diễn tả thói quen, quy trình lặp lại hoặc thông tin ổn định. Trong email công việc, thì này thường xuất hiện khi nêu lịch làm việc, nhiệm vụ thường xuyên và cách một bộ phận vận hành.',
        'Với động từ thường, dùng dạng nguyên mẫu sau I/you/we/they; thêm -s hoặc -es sau chủ ngữ ngôi thứ ba số ít. Các từ như every Monday, usually và regularly giúp làm rõ tính lặp lại, nhưng cần đọc cả ngữ cảnh.',
      ],
      structures: [
        {
          label: 'Khẳng định · động từ thường',
          pattern: 'I / You / We / They + V\nHe / She / It + V-s / V-es',
        },
        { label: 'Phủ định · động từ thường', pattern: 'S + do not / does not + V (nguyên mẫu)' },
        { label: 'Nghi vấn · động từ thường', pattern: 'Do / Does + S + V (nguyên mẫu)?' },
      ],
      examples: [
        {
          sentence: 'Our team sends a weekly update every Monday.',
          meaning: 'Nhóm chúng tôi gửi bản cập nhật hằng tuần vào mỗi thứ Hai.',
          explanation:
            '“Our team” là chủ ngữ số ít trong câu này; “sends” mô tả công việc lặp lại mỗi tuần.',
        },
        {
          sentence: 'We do not process orders on Sundays.',
          meaning: 'Chúng tôi không xử lý đơn hàng vào các ngày Chủ nhật.',
          explanation:
            'Sau “do not”, động từ “process” giữ dạng nguyên mẫu. Email đang mô tả lịch làm việc thường lệ.',
        },
        {
          sentence: 'Does the office open at eight?',
          meaning: 'Văn phòng có mở cửa lúc tám giờ không?',
          explanation:
            'Dùng “Does” với chủ ngữ số ít “the office”; sau trợ động từ, “open” không thêm -s.',
        },
      ],
      notes: [
        'Sau does hoặc does not, không thêm -s/-es vào động từ chính: “does not send”, không dùng “does not sends”.',
        'Các cấu trúc trên áp dụng cho động từ thường. Động từ “be” dùng am/is/are và không dùng do/does để tạo phủ định hoặc nghi vấn.',
        'Phân biệt một quy trình thường lệ với hoạt động đang diễn ra. Câu “We review invoices every Friday” mô tả lịch lặp lại, không tự khẳng định việc đó đang xảy ra ngay lúc nói.',
      ],
    },
  },
  {
    id: 'demo-lesson-002',
    body: {
      theory: [
        'Thì hiện tại tiếp diễn diễn tả hoạt động đang xảy ra tại thời điểm nói hoặc trong một giai đoạn tạm thời quanh hiện tại. Trong công việc, có thể dùng thì này để báo cáo tiến độ của một nhiệm vụ đang được thực hiện.',
        'Cấu trúc gồm am/is/are và động từ dạng V-ing. Chọn dạng của “be” theo chủ ngữ; các cụm now, at the moment và this week có thể giúp xác định ngữ cảnh đang diễn ra hoặc tạm thời.',
      ],
      structures: [
        {
          label: 'Khẳng định',
          pattern: 'I + am + V-ing\nHe / She / It + is + V-ing\nYou / We / They + are + V-ing',
        },
        { label: 'Phủ định', pattern: 'S + am / is / are + not + V-ing' },
        { label: 'Nghi vấn', pattern: 'Am / Is / Are + S + V-ing?' },
      ],
      examples: [
        {
          sentence: 'The finance team is reviewing the expense reports now.',
          meaning: 'Nhóm tài chính đang xem xét các báo cáo chi phí lúc này.',
          explanation:
            '“Is reviewing” cho biết hoạt động đang diễn ra; “now” làm rõ thời điểm hiện tại.',
        },
        {
          sentence: 'We are not using the main meeting room this week.',
          meaning: 'Chúng tôi không sử dụng phòng họp chính trong tuần này.',
          explanation:
            '“Are not using” diễn tả tình huống tạm thời trong tuần, không phải lịch cố định lâu dài.',
        },
        {
          sentence: 'Are the technicians installing the new software?',
          meaning: 'Các kỹ thuật viên có đang cài phần mềm mới không?',
          explanation:
            'Đưa “Are” lên trước chủ ngữ số nhiều “the technicians”; động từ chính vẫn ở dạng “installing”.',
        },
      ],
      notes: [
        'Không bỏ am/is/are: dùng “She is preparing the slides”, không dùng “She preparing the slides”.',
        'Một số động từ chỉ trạng thái, như know và belong, thường dùng hiện tại đơn trong nghĩa trạng thái thay vì dạng tiếp diễn.',
        'Đối chiếu ngữ cảnh: “We check the equipment every morning” là thói quen; “We are checking the equipment now” là hoạt động đang diễn ra.',
      ],
    },
  },
];
