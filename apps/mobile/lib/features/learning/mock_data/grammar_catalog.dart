import '../models/grammar_lesson.dart';

/// Mock catalog used until the Grammar API/repository is integrated.
class GrammarCatalog {
  GrammarCatalog._();

  static const List<GrammarLesson> lessons = [
    GrammarLesson(
      id: 'g1',
      title: 'Giới từ chỉ thời gian: in, on, at, by',
      category: 'Giới từ',
      summary: 'Phân biệt cách dùng các giới từ thường gặp trong thông báo và lịch làm việc.',
      level: 'Cơ bản',
      durationMinutes: 8,
      sections: [
        GrammarLessonSection(
          title: 'IN — khoảng thời gian',
          explanation:
              'Dùng in với tháng, năm, mùa và các khoảng thời gian dài.',
          examples: [
            'The conference will take place in November.',
            'Sales increased in 2026.',
          ],
        ),
        GrammarLessonSection(
          title: 'ON — ngày cụ thể',
          explanation: 'Dùng on với thứ trong tuần và ngày tháng cụ thể.',
          examples: [
            'The office is closed on Monday.',
            'The interview is on May 5.',
          ],
        ),
        GrammarLessonSection(
          title: 'AT — thời điểm cụ thể',
          explanation:
              'Dùng at với giờ, thời điểm hoặc một mốc thời gian xác định.',
          examples: ['The meeting starts at 8 a.m.', 'Please arrive at noon.'],
        ),
        GrammarLessonSection(
          title: 'BY — không muộn hơn một mốc',
          explanation: 'Dùng by để diễn tả hạn chót: một việc phải hoàn tất trước hoặc tại thời điểm được nêu.',
          examples: [
            'Please submit the report by Friday.',
            'The package should arrive by noon.',
          ],
        ),
      ],
      keyTakeaway:
          'IN = khoảng thời gian; ON = ngày; AT = thời điểm; BY = hạn chót.',
    ),
    GrammarLesson(
      id: 'g2',
      title: 'Hiện tại đơn và hiện tại tiếp diễn',
      category: 'Thì động từ',
      summary: 'Nhận biết thói quen, lịch trình và hành động đang diễn ra.',
      level: 'Cơ bản',
      durationMinutes: 10,
      sections: [
        GrammarLessonSection(
          title: 'Hiện tại đơn (Present Simple)',
          explanation: 'Diễn tả thói quen, sự thật hoặc lịch trình cố định. Với chủ ngữ ngôi thứ ba số ít, động từ thường thêm -s/-es.',
          examples: [
            'The store opens at 9 a.m.',
            'Ms. Lee manages the sales team.',
          ],
        ),
        GrammarLessonSection(
          title: 'Hiện tại tiếp diễn (Present Continuous)',
          explanation: 'Diễn tả hành động đang diễn ra hoặc kế hoạch đã sắp xếp trong tương lai gần. Cấu trúc: am/is/are + V-ing.',
          examples: [
            'The staff are attending a workshop now.',
            'We are meeting the supplier tomorrow.',
          ],
        ),
        GrammarLessonSection(
          title: 'Dấu hiệu nhận biết',
          explanation: 'Present Simple thường đi với usually, often, every day. Present Continuous thường đi với now, currently, at the moment.',
          examples: [
            'She usually checks the invoices.',
            'They are currently reviewing the contract.',
          ],
        ),
      ],
      keyTakeaway: 'Thói quen hoặc lịch trình: Present Simple. Hành động đang diễn ra: Present Continuous.',
    ),
    GrammarLesson(
      id: 'g3',
      title: 'Sự hòa hợp giữa chủ ngữ và động từ',
      category: 'Cấu trúc câu',
      summary: 'Chọn dạng động từ phù hợp với chủ ngữ số ít hoặc số nhiều.',
      level: 'Cơ bản',
      durationMinutes: 9,
      sections: [
        GrammarLessonSection(
          title: 'Chủ ngữ số ít',
          explanation: 'Ở thì hiện tại đơn, danh từ hoặc đại từ ngôi thứ ba số ít thường đi với động từ thêm -s/-es.',
          examples: [
            'The manager approves the budget.',
            'Each employee receives an ID card.',
          ],
        ),
        GrammarLessonSection(
          title: 'Chủ ngữ số nhiều',
          explanation: 'Chủ ngữ số nhiều đi với động từ nguyên mẫu không thêm -s/-es ở thì hiện tại đơn.',
          examples: [
            'The employees receive training.',
            'Several departments share the office.',
          ],
        ),
        GrammarLessonSection(
          title: 'Các chủ ngữ dễ nhầm',
          explanation: 'Các từ each, every, everyone, somebody thường được xem là chủ ngữ số ít. Khi có cụm giới từ theo sau, hãy xác định danh từ chính của chủ ngữ.',
          examples: [
            'Each of the reports is complete.',
            'The list of applicants is on the desk.',
          ],
        ),
      ],
      keyTakeaway: 'Xác định danh từ chính của chủ ngữ trước khi chia động từ; không để danh từ trong cụm giới từ đánh lạc hướng.',
    ),
    GrammarLesson(
      id: 'g4',
      title: 'Nhận biết loại từ trong câu',
      category: 'Từ loại',
      summary: 'Phân biệt danh từ, động từ, tính từ và trạng từ qua vị trí trong câu.',
      level: 'Cơ bản',
      durationMinutes: 10,
      sections: [
        GrammarLessonSection(
          title: 'Danh từ (Noun)',
          explanation: 'Danh từ thường đứng sau mạo từ, tính từ sở hữu hoặc tính từ; có thể làm chủ ngữ hoặc tân ngữ.',
          examples: [
            'The proposal needs approval.',
            'Our department hired an assistant.',
          ],
        ),
        GrammarLessonSection(
          title: 'Động từ (Verb)',
          explanation: 'Động từ diễn tả hành động hoặc trạng thái và thường đứng sau chủ ngữ.',
          examples: [
            'The company expanded its services.',
            'The system remains available.',
          ],
        ),
        GrammarLessonSection(
          title: 'Tính từ và trạng từ',
          explanation: 'Tính từ bổ nghĩa cho danh từ hoặc đứng sau động từ nối. Trạng từ thường bổ nghĩa cho động từ, tính từ hoặc trạng từ khác.',
          examples: [
            'The new policy is effective.',
            'Please respond promptly.',
          ],
        ),
      ],
      keyTakeaway: 'Quan sát vị trí chỗ trống và từ đứng trước/sau để xác định loại từ cần điền.',
    ),
    GrammarLesson(
      id: 'g5',
      title: 'Câu bị động (Passive Voice)',
      category: 'Cấu trúc câu',
      summary: 'Sử dụng câu bị động khi muốn nhấn mạnh đối tượng chịu tác động của hành động.',
      level: 'Trung cấp',
      durationMinutes: 10,
      sections: [
        GrammarLessonSection(
          title: 'Cấu trúc cơ bản',
          explanation: 'Câu bị động có dạng: chủ ngữ + be + past participle (V3/ed). Động từ be thay đổi theo thì và chủ ngữ.',
          examples: [
            'The documents are stored securely.',
            'The road was repaired last week.',
          ],
        ),
        GrammarLessonSection(
          title: 'Câu bị động ở các thì',
          explanation: 'Giữ đúng thì của câu gốc khi chuyển sang bị động: is/are + V3, was/were + V3, will be + V3.',
          examples: [
            'The orders are processed daily.',
            'The equipment will be delivered tomorrow.',
          ],
        ),
        GrammarLessonSection(
          title: 'Khi nào dùng by',
          explanation: 'Dùng by + tác nhân khi người hoặc bộ phận thực hiện hành động cần được nhắc đến. Có thể lược bỏ tác nhân nếu không quan trọng hoặc đã rõ.',
          examples: [
            'The report was prepared by the finance team.',
            'All applications are reviewed carefully.',
          ],
        ),
      ],
      keyTakeaway:
          'Khi gặp câu bị động, kiểm tra dạng của be và phân từ quá khứ V3/ed.',
    ),
    GrammarLesson(
      id: 'g6',
      title: 'So sánh hơn và so sánh nhất',
      category: 'Tính từ và trạng từ',
      summary: 'So sánh đặc điểm, chất lượng và hiệu suất giữa các đối tượng.',
      level: 'Trung cấp',
      durationMinutes: 8,
      sections: [
        GrammarLessonSection(
          title: 'So sánh hơn',
          explanation: 'Tính từ ngắn thường dùng -er + than; tính từ dài thường dùng more + adjective + than.',
          examples: [
            'This model is cheaper than the previous one.',
            'The new system is more reliable than the old system.',
          ],
        ),
        GrammarLessonSection(
          title: 'So sánh nhất',
          explanation: 'Tính từ ngắn thường dùng the -est; tính từ dài thường dùng the most + adjective.',
          examples: [
            'This is the fastest route.',
            'It is the most convenient option.',
          ],
        ),
        GrammarLessonSection(
          title: 'Một số dạng bất quy tắc',
          explanation: 'Một số tính từ có dạng so sánh đặc biệt: good – better – best; bad – worse – worst; far – farther/further – farthest/furthest.',
          examples: [
            'The second proposal is better.',
            'This is our best-selling product.',
          ],
        ),
      ],
      keyTakeaway: 'So sánh hơn thường có than; so sánh nhất thường đi với the và xác định một đối tượng nổi bật trong nhóm.',
    ),
    GrammarLesson(
      id: 'g7',
      title: 'Mệnh đề quan hệ',
      category: 'Mệnh đề',
      summary:
          'Dùng who, which, that và whose để bổ sung thông tin cho danh từ.',
      level: 'Trung cấp',
      durationMinutes: 10,
      sections: [
        GrammarLessonSection(
          title: 'Who và which',
          explanation: 'Who thường thay cho người; which thường thay cho vật hoặc sự việc.',
          examples: [
            'The applicant who called yesterday has arrived.',
            'The device which we ordered is ready.',
          ],
        ),
        GrammarLessonSection(
          title: 'That và whose',
          explanation: 'That có thể thay cho người hoặc vật trong mệnh đề quan hệ xác định. Whose diễn tả quan hệ sở hữu.',
          examples: [
            'The report that you requested is attached.',
            'The employee whose desk is near the window is absent.',
          ],
        ),
        GrammarLessonSection(
          title: 'Lưu ý khi làm bài',
          explanation: 'Xác định danh từ đứng trước chỗ trống và vai trò ngữ pháp còn thiếu trong mệnh đề để chọn đại từ quan hệ phù hợp.',
          examples: [
            'The company that hired him is expanding.',
            'The manager who approved the plan is speaking.',
          ],
        ),
      ],
      keyTakeaway: 'Who = người; which = vật/sự việc; whose = sở hữu; that = người hoặc vật trong mệnh đề xác định.',
    ),
    GrammarLesson(
      id: 'g8',
      title: 'Liên từ và từ nối thông dụng',
      category: 'Liên từ',
      summary:
          'Diễn đạt quan hệ bổ sung, nguyên nhân, kết quả và sự tương phản.',
      level: 'Trung cấp',
      durationMinutes: 9,
      sections: [
        GrammarLessonSection(
          title: 'Bổ sung thông tin',
          explanation: 'And nối các thành phần cùng chức năng; also, moreover và in addition thường bổ sung một ý mới.',
          examples: [
            'The package is affordable and reliable.',
            'Moreover, the service includes free support.',
          ],
        ),
        GrammarLessonSection(
          title: 'Nguyên nhân và kết quả',
          explanation: 'Because/ since giới thiệu nguyên nhân; so/therefore diễn tả kết quả.',
          examples: [
            'The flight was delayed because of bad weather.',
            'The demand increased, so the company hired more staff.',
          ],
        ),
        GrammarLessonSection(
          title: 'Tương phản và nhượng bộ',
          explanation: 'But/however diễn tả sự tương phản; although/even though giới thiệu mệnh đề nhượng bộ.',
          examples: [
            'The product is expensive, but it is durable.',
            'Although the office is small, it is well organized.',
          ],
        ),
      ],
      keyTakeaway: 'Phân biệt liên từ nối mệnh đề với từ nối đứng đầu câu; chú ý dấu câu và cấu trúc theo sau.',
    ),
  ];

  static GrammarLesson? findById(String id) {
    for (final lesson in lessons) {
      if (lesson.id == id) return lesson;
    }
    return null;
  }
}
