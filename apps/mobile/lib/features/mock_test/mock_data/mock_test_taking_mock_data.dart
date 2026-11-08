import '../models/test_attempt_group.dart';
import '../models/test_attempt_question.dart';

class MockTestQuestionSeed {
  const MockTestQuestionSeed({
    required this.question,
    required this.correctOption,
    this.explanation,
  });

  final TestAttemptQuestion question;
  final String correctOption;
  final String? explanation;
}

class MockTestQuestionBank {
  const MockTestQuestionBank({required this.questions, required this.groups});

  final List<MockTestQuestionSeed> questions;
  final List<TestAttemptGroup> groups;

  Map<String, String> get correctOptions => {
    for (final seed in questions) seed.question.questionId: seed.correctOption,
  };
}

/// Original, deterministic sample content for validating the seven-part UI.
/// Replace this source with the Exam Service attempt snapshot when API work starts.
class MockTestTakingMockData {
  MockTestTakingMockData._();

  static const Map<int, int> expectedQuestionCounts = {
    1: 6,
    2: 25,
    3: 39,
    4: 30,
    5: 30,
    6: 16,
    7: 54,
  };

  static const List<String> _codes = ['A', 'B', 'C', 'D'];

  static String? _part5Explanation(
    String questionText,
    String correctOption,
    List<String> optionTexts,
  ) {
    final optionIndex = _codes.indexOf(correctOption);
    final answer = optionIndex >= 0 && optionIndex < optionTexts.length
        ? optionTexts[optionIndex]
        : correctOption;

    if (questionText.contains('submitted _____ Friday afternoon')) {
      return '"By" diễn tả hạn chót: báo cáo phải được nộp chậm nhất vào chiều thứ Sáu.';
    }
    if (questionText.contains('will _____ the visiting client')) {
      return 'Sau động từ khuyết thiếu "will" dùng động từ nguyên mẫu không "to"; vì vậy chọn "$answer".';
    }
    if (questionText.contains('is _____ than the previous version')) {
      return 'Cấu trúc so sánh hơn với tính từ dài là "more + adjective + than".';
    }
    if (questionText.contains('required _____ at the front desk')) {
      return 'Cấu trúc "be required to + verb" diễn tả một yêu cầu hoặc nghĩa vụ.';
    }
    if (questionText.contains('reviewed the proposal _____')) {
      return 'Vị trí này bổ nghĩa cho động từ "reviewed", nên cần trạng từ "$answer".';
    }
    if (questionText.contains('Neither the manager nor the assistants')) {
      return 'Trong cấu trúc "neither ... nor ...", động từ thường hòa hợp với chủ ngữ gần nó nhất; "assistants" là số nhiều.';
    }
    if (questionText.contains('room is reserved _____')) {
      return '"Reserved for" diễn tả mục đích hoặc đối tượng mà phòng được dành riêng.';
    }
    if (questionText.contains('may receive a refund _____')) {
      return 'Mệnh đề sau diễn tả điều kiện để khách hàng được hoàn tiền, nên dùng liên từ điều kiện.';
    }
    if (questionText.contains('will open _____ the renovation')) {
      return '"Once" là liên từ thời gian, mang nghĩa ngay khi/một khi công việc cải tạo hoàn tất.';
    }
    if (questionText.contains('worked with this supplier _____ 2019')) {
      return '"Since" đi với một mốc thời gian bắt đầu, chẳng hạn năm 2019.';
    }
    if (questionText.contains('technician _____ you notice')) {
      return 'Mệnh đề sau nêu điều kiện cần liên hệ kỹ thuật viên, vì vậy dùng "if".';
    }
    if (questionText.contains('documents _____ by the legal department')) {
      return 'Câu dùng thể bị động ở quá khứ: "were + past participle".';
    }
    if (questionText.contains('looking for a _____ solution')) {
      return 'Từ đứng trước danh từ "solution" cần là tính từ để mô tả giải pháp.';
    }
    if (questionText.contains('arrive _____ the end of the week')) {
      return '"By the end of the week" diễn tả thời hạn muộn nhất là cuối tuần.';
    }
    if (questionText.contains('identification cards _____ visible')) {
      return 'Từ cần điền bổ nghĩa cho tính từ "visible"; cấu trúc này cần trạng từ.';
    }
    return 'Đáp án được đánh dấu trong bộ câu hỏi mẫu là "$answer".';
  }

  static MockTestQuestionBank buildBank() {
    final questions = <MockTestQuestionSeed>[];
    final groups = <TestAttemptGroup>[];

    void addQuestion({
      required int part,
      required int orderNo,
      required String type,
      String questionText = '',
      required List<String> optionTexts,
      required String correctOption,
      String? explanation,
      String? groupId,
      int? positionInGroup,
      String? audioUrl,
      String? imageUrl,
      String? imageDescription,
    }) {
      final options = List<TestAttemptOption>.generate(
        optionTexts.length,
        (index) => TestAttemptOption(
          optionCode: _codes[index],
          optionText: optionTexts[index],
        ),
        growable: false,
      );
      questions.add(
        MockTestQuestionSeed(
          question: TestAttemptQuestion(
            questionId: 'mock-question-${orderNo.toString().padLeft(3, '0')}',
            part: part,
            orderNo: orderNo,
            type: type,
            questionText: questionText,
            options: options,
            groupId: groupId,
            positionInGroup: positionInGroup,
            audioUrl: audioUrl,
            imageUrl: imageUrl,
            imageDescription: imageDescription,
          ),
          correctOption: correctOption,
          explanation:
              explanation ??
              (part == 5
                  ? _part5Explanation(questionText, correctOption, optionTexts)
                  : null),
        ),
      );
    }

    // Part 1: 6 image-description questions.
    const imageDescriptions = [
      'A worker is arranging documents on a desk.',
      'Several passengers are waiting near a platform.',
      'A staff member is serving a customer at a counter.',
      'Two colleagues are reviewing a chart on a screen.',
      'A delivery worker is unloading boxes from a vehicle.',
      'People are seated around a table during a meeting.',
    ];
    for (var index = 0; index < 6; index++) {
      addQuestion(
        part: 1,
        orderNo: index + 1,
        type: 'IMAGE_DESCRIPTION',
        optionTexts: const ['', '', '', ''],
        correctOption: _codes[index % 4],
        imageDescription: imageDescriptions[index],
      );
    }

    // Part 2: 25 question-response items. Audio and response transcripts are
    // intentionally absent from the mock bank; only A/B/C are selectable.
    for (var index = 0; index < 25; index++) {
      addQuestion(
        part: 2,
        orderNo: 7 + index,
        type: 'QUESTION_RESPONSE',
        optionTexts: const ['', '', ''],
        correctOption: _codes[index % 3],
      );
    }

    // Part 3: 13 conversations x 3 questions.
    const conversationQuestions = [
      'What are the speakers mainly discussing?',
      'What does the woman ask the man to do?',
      'What will the man most likely do next?',
    ];
    const conversationOptions = [
      [
        'A delivery schedule',
        'A hiring decision',
        'A budget proposal',
        'A travel policy',
      ],
      [
        'Contact a supplier',
        'Reserve a meeting room',
        'Update a document',
        'Call a customer',
      ],
      [
        'Send an e-mail',
        'Visit another office',
        'Review a contract',
        'Prepare a presentation',
      ],
    ];
    var orderNo = 32;
    for (var groupIndex = 0; groupIndex < 13; groupIndex++) {
      final groupId = 'mock-p3-group-${groupIndex + 1}';
      final start = orderNo;
      groups.add(
        TestAttemptGroup(
          groupId: groupId,
          part: 3,
          orderNo: groupIndex + 1,
          type: 'CONVERSATION',
          instruction:
              'Questions $start–${start + 2} refer to the following conversation.',
        ),
      );
      for (var position = 0; position < 3; position++) {
        addQuestion(
          part: 3,
          orderNo: orderNo,
          type: 'SINGLE_CHOICE',
          questionText: conversationQuestions[position],
          optionTexts: conversationOptions[position],
          correctOption: _codes[(groupIndex + position) % 4],
          groupId: groupId,
          positionInGroup: position + 1,
        );
        orderNo++;
      }
    }

    // Part 4: 10 short talks x 3 questions.
    const talkQuestions = [
      'What is the purpose of the talk?',
      'Who is the intended audience?',
      'What are listeners asked to do?',
    ];
    const talkOptions = [
      [
        'To announce a schedule change',
        'To introduce a new service',
        'To report a problem',
        'To describe a location',
      ],
      [
        'Office employees',
        'New customers',
        'Event organizers',
        'Tour participants',
      ],
      [
        'Check a Web site',
        'Speak with a supervisor',
        'Complete a form',
        'Arrive before noon',
      ],
    ];
    orderNo = 71;
    for (var groupIndex = 0; groupIndex < 10; groupIndex++) {
      final groupId = 'mock-p4-group-${groupIndex + 1}';
      final start = orderNo;
      groups.add(
        TestAttemptGroup(
          groupId: groupId,
          part: 4,
          orderNo: groupIndex + 1,
          type: 'SHORT_TALK',
          instruction:
              'Questions $start–${start + 2} refer to the following talk.',
        ),
      );
      for (var position = 0; position < 3; position++) {
        addQuestion(
          part: 4,
          orderNo: orderNo,
          type: 'SINGLE_CHOICE',
          questionText: talkQuestions[position],
          optionTexts: talkOptions[position],
          correctOption: _codes[(groupIndex + position + 1) % 4],
          groupId: groupId,
          positionInGroup: position + 1,
        );
        orderNo++;
      }
    }

    // Part 5: 30 single-sentence completion questions.
    const part5Items = [
      (
        'The annual report must be submitted _____ Friday afternoon.',
        ['by', 'since', 'during', 'toward'],
        'A',
      ),
      (
        'Ms. Rivera will _____ the visiting client at the station.',
        ['meet', 'meets', 'meeting', 'met'],
        'A',
      ),
      (
        'The updated software is _____ than the previous version.',
        ['more efficient', 'most efficiently', 'efficiency', 'efficiently'],
        'A',
      ),
      (
        'All visitors are required _____ at the front desk.',
        ['to register', 'registering', 'registered', 'register'],
        'A',
      ),
      (
        'The director reviewed the proposal _____ before approving it.',
        ['carefully', 'careful', 'care', 'caring'],
        'A',
      ),
      (
        'Neither the manager nor the assistants _____ available this morning.',
        ['are', 'is', 'was', 'be'],
        'A',
      ),
      (
        'The conference room is reserved _____ the afternoon session.',
        ['for', 'among', 'while', 'although'],
        'A',
      ),
      (
        'Customers may receive a refund _____ they present the original receipt.',
        ['if', 'despite', 'unless', 'whereas'],
        'A',
      ),
      (
        'The new branch will open _____ the renovation is complete.',
        ['once', 'during', 'because of', 'in spite'],
        'A',
      ),
      (
        'The company has worked with this supplier _____ 2019.',
        ['since', 'for', 'until', 'during'],
        'A',
      ),
      (
        'Please contact the technician _____ you notice any unusual noise.',
        ['if', 'whether', 'because', 'while'],
        'A',
      ),
      (
        'The documents _____ by the legal department yesterday.',
        ['were reviewed', 'reviewed', 'are reviewing', 'have review'],
        'A',
      ),
      (
        'The marketing team is looking for a _____ solution.',
        ['practical', 'practice', 'practically', 'practitioner'],
        'A',
      ),
      (
        'The shipment is expected to arrive _____ the end of the week.',
        ['by', 'at', 'on', 'in'],
        'A',
      ),
      (
        'Employees should keep their identification cards _____ visible.',
        ['clearly', 'clear', 'clarity', 'clearing'],
        'A',
      ),
    ];
    for (var index = 0; index < 30; index++) {
      final item = part5Items[index % part5Items.length];
      addQuestion(
        part: 5,
        orderNo: 101 + index,
        type: 'SINGLE_CHOICE',
        questionText: item.$1,
        optionTexts: item.$2,
        correctOption: item.$3,
      );
    }

    // Part 6: 4 text sets x 4 blanks. [[n]] marks each blank in the passage.
    const part6Passages = [
      'To: All Staff\nSubject: Conference Room Maintenance\n\nThe main conference room will be unavailable [[1]] Monday morning while new equipment is installed. Employees who have meetings scheduled during this period should reserve another room [[2]] the online booking system. The work is expected to be completed by noon. We apologize for any inconvenience and appreciate your [[3]]. Please contact Facilities if you need [[4]] assistance.',
      'To: Customers\nSubject: Updated Store Hours\n\nBeginning next month, our downtown location will close [[1]] 8 P.M. on weekdays. The change will allow our team to complete inventory checks more [[2]]. Weekend hours will remain unchanged. A complete schedule is available on our Web site, where customers can also [[3]] for updates. Thank you for your continued [[4]].',
      'To: Project Team\nSubject: Document Review\n\nPlease review the attached proposal before [[1]] it to the client. Several figures have been revised [[2]] the latest sales report. Add comments directly to the shared file so that the editor can make the final changes. We plan to distribute the completed version [[3]] Thursday. Your prompt response is greatly [[4]].',
      'To: Workshop Participants\nSubject: Registration Confirmation\n\nThank you for registering for the professional development workshop. The event will begin [[1]] 9:30 A.M. in Room 204. Please bring a copy of the materials [[2]] were sent with your confirmation. Coffee and refreshments will be provided. Participants who need parking information should contact the office [[3]] the event. We look forward to [[4]] you.',
    ];
    const part6Options = [
      (['on', 'at', 'for', 'from'], 'A'),
      (['through', 'although', 'unless', 'beside'], 'A'),
      (['cooperation', 'cooperative', 'cooperate', 'cooperatively'], 'A'),
      (['additional', 'addition', 'additionally', 'add'], 'A'),
      (['at', 'by', 'from', 'among'], 'A'),
      (['efficiently', 'efficient', 'efficiency', 'more efficient'], 'A'),
      (['sign up', 'signed', 'signing', 'signature'], 'A'),
      (['support', 'supportive', 'supporting', 'supported'], 'A'),
      (['sending', 'send', 'sent', 'sends'], 'A'),
      (['according to', 'because', 'despite', 'unless'], 'A'),
      (['by', 'since', 'during', 'until'], 'A'),
      (['appreciated', 'appreciative', 'appreciate', 'appreciation'], 'A'),
      (['at', 'on', 'in', 'for'], 'A'),
      (['that', 'what', 'who', 'where'], 'A'),
      (['before', 'unless', 'although', 'between'], 'A'),
      (['meeting', 'meet', 'met', 'meets'], 'A'),
    ];
    orderNo = 131;
    for (var groupIndex = 0; groupIndex < 4; groupIndex++) {
      final groupId = 'mock-p6-group-${groupIndex + 1}';
      groups.add(
        TestAttemptGroup(
          groupId: groupId,
          part: 6,
          orderNo: groupIndex + 1,
          type: 'TEXT_COMPLETION',
          instruction:
              'Questions $orderNo–${orderNo + 3} refer to the following text.',
          passageText: part6Passages[groupIndex],
        ),
      );
      for (var position = 0; position < 4; position++) {
        final choice = part6Options[groupIndex * 4 + position];
        addQuestion(
          part: 6,
          orderNo: orderNo,
          type: 'SINGLE_CHOICE',
          questionText: 'Which choice best completes blank (${position + 1})?',
          optionTexts: choice.$1,
          correctOption: choice.$2,
          groupId: groupId,
          positionInGroup: position + 1,
        );
        orderNo++;
      }
    }

    // Part 7 single passages: 10 sets, 29 questions in total.
    const singlePassageCounts = [2, 3, 2, 3, 3, 4, 2, 3, 4, 3];
    const singlePassageTexts = [
      'To: Jordan Lee\nFrom: Office Services\nSubject: Desk Assignment\n\nYour request to move to the west side of the office has been approved. The new desk will be available on Tuesday. Please label your personal equipment before the move. The Facilities team will transfer the computer monitor after 4 P.M.',
      'CITY ARTS CENTER\n\nThe center will host a photography exhibition from June 4 through June 18. Admission is free on weekdays before 5 P.M. Guided tours are available on Saturdays. Visitors can reserve a place on the center website.',
      'To: Shipping Department\n\nA package scheduled for delivery this morning has been delayed because of severe weather. The carrier expects to deliver it tomorrow. Please notify the customer and update the tracking record.',
      'NORTHLINE TRAVEL\n\nPassengers traveling to the airport should use the express route this weekend. Regular service will operate on a revised schedule while road repairs are underway. Updated departure times are posted at each station.',
      'To: All Employees\nSubject: Benefits Enrollment\n\nThe annual benefits enrollment period begins Monday. Staff members may compare available plans through the employee portal. A representative will be available in the training room on Wednesday to answer questions.',
      'RIVERSIDE HOTEL\n\nThe hotel restaurant will be closed for maintenance from August 12 to August 14. Breakfast will be served in the conference lounge during this period. Guests who have already booked private dining will be contacted by the events team.',
      'To: Ms. Patel\n\nThank you for your interest in the office coordinator position. We would like to invite you to an interview next Thursday. Please reply with your preferred time from the available options listed below.',
      'COMMUNITY MARKET\n\nLocal producers will offer fresh food and handmade goods every Saturday this month. The market opens at 8 A.M. and closes at 2 P.M. Visitors can use the west parking lot, which is adjacent to the main entrance.',
      'To: Design Team\nSubject: Revised Presentation\n\nThe client has requested that the product demonstration include the new reporting feature. Please update slides 8 through 10 and send the revised presentation to the project lead by Wednesday afternoon.',
      'WESTBROOK LIBRARY\n\nBeginning next week, the second-floor study area will remain open until 10 P.M. on weekdays. The extended hours are part of a pilot program. Visitors are asked to keep conversations in the designated group rooms.',
    ];
    const singleQuestions = [
      'What is the main purpose of the message?',
      'When will the change take effect?',
      'What are readers asked to do?',
      'What is indicated about the service?',
    ];
    const singleOptions = [
      [
        'To announce an arrangement',
        'To request payment',
        'To introduce a product',
        'To advertise a vacancy',
      ],
      [
        'Next Tuesday',
        'At the end of the month',
        'This evening',
        'Early next year',
      ],
      [
        'Contact a department',
        'Complete a survey',
        'Bring identification',
        'Visit a different location',
      ],
      [
        'It is temporarily unavailable',
        'It is offered at no cost',
        'It has been expanded',
        'It requires a reservation',
      ],
    ];
    orderNo = 147;
    for (
      var groupIndex = 0;
      groupIndex < singlePassageCounts.length;
      groupIndex++
    ) {
      final groupId = 'mock-p7-single-${groupIndex + 1}';
      final count = singlePassageCounts[groupIndex];
      groups.add(
        TestAttemptGroup(
          groupId: groupId,
          part: 7,
          orderNo: groupIndex + 1,
          type: 'SINGLE_PASSAGE',
          instruction:
              'Questions $orderNo–${orderNo + count - 1} refer to the following text.',
          passageText: singlePassageTexts[groupIndex],
        ),
      );
      for (var position = 0; position < count; position++) {
        addQuestion(
          part: 7,
          orderNo: orderNo,
          type: 'SINGLE_CHOICE',
          questionText: singleQuestions[position % singleQuestions.length],
          optionTexts: singleOptions[position % singleOptions.length],
          correctOption: _codes[(groupIndex + position) % 4],
          groupId: groupId,
          positionInGroup: position + 1,
        );
        orderNo++;
      }
    }

    // Part 7 multi-text sets: five questions for each set (three double and two triple).
    final multiSetQuestions = [
      'What is the purpose of the first message?',
      'When is the service scheduled to begin?',
      'What does the second document indicate?',
      'What can be inferred about the customer?',
      'Which detail is mentioned in both documents?',
    ];
    final multiSetOptions = [
      [
        'To confirm a reservation',
        'To report a technical issue',
        'To request a quotation',
        'To announce a staff change',
      ],
      ['On Monday', 'On Wednesday', 'On Friday', 'At the end of the month'],
      [
        'A revised time is available',
        'A fee has been canceled',
        'A product is out of stock',
        'An office has moved',
      ],
      [
        'The customer has contacted the office before',
        'The customer prefers paper forms',
        'The customer will pay in cash',
        'The customer works nearby',
      ],
      [
        'The appointment date',
        'The reference number',
        'The delivery address',
        "The employee's title",
      ],
    ];
    final doubleDocs = [
      [
        (
          'E-mail from Facilities',
          'The annual inspection of the west building will take place on September 12. Employees should keep hallways clear and report maintenance concerns to Facilities before the inspection.',
        ),
        (
          'Inspection Schedule',
          '8:30 A.M. — Lobby and reception\n10:00 A.M. — Office floors\n1:00 P.M. — Meeting rooms\nThe inspection team will begin on the ground floor.',
        ),
      ],
      [
        (
          'Customer Inquiry',
          'A customer asks whether a replacement printer can be delivered before the end of the week and requests an estimate for installation.',
        ),
        (
          'Service Estimate',
          'Delivery is available Thursday morning. Standard installation is included in the quoted price. The customer must confirm the order by Tuesday.',
        ),
      ],
      [
        (
          'Event Announcement',
          'The Lakeside Business Association will hold its quarterly networking event at the Harbor Hotel. Registration is required because seating is limited.',
        ),
        (
          'Registration Confirmation',
          'Your registration is confirmed for October 8. Please bring the confirmation number to the welcome desk. The first presentation begins at 6 P.M.',
        ),
      ],
    ];
    final tripleDocs = [
      [
        (
          'Project E-mail',
          'The design review has been moved to Thursday. Team members should upload their revised drawings one day earlier.',
        ),
        (
          'Room Booking',
          'Conference Room B is reserved from 2 P.M. to 3:30 P.M. on Thursday for the design review.',
        ),
        (
          'Team Message',
          'The engineering lead will join remotely. Please test the video equipment before the meeting starts.',
        ),
      ],
      [
        (
          'Store Notice',
          'The Central Street location will introduce express checkout next month. Staff training will be held before the launch.',
        ),
        (
          'Training Schedule',
          'Cashiers attend the morning session on Tuesday. Floor supervisors attend the afternoon session.',
        ),
        (
          'Manager Message',
          'Employees who cannot attend their assigned session should contact the store manager to arrange another time.',
        ),
      ],
    ];
    for (var setIndex = 0; setIndex < 5; setIndex++) {
      final groupId = 'mock-p7-multi-${setIndex + 1}';
      final isTriple = setIndex >= 3;
      final docs = isTriple ? tripleDocs[setIndex - 3] : doubleDocs[setIndex];
      groups.add(
        TestAttemptGroup(
          groupId: groupId,
          part: 7,
          orderNo: 11 + setIndex,
          type: isTriple ? 'TRIPLE_PASSAGE' : 'DOUBLE_PASSAGE',
          instruction:
              'Questions $orderNo–${orderNo + 4} refer to the following related documents.',
          assets: [
            for (
              var documentIndex = 0;
              documentIndex < docs.length;
              documentIndex++
            )
              TestAttemptGroupAsset(
                assetId: '$groupId-document-${documentIndex + 1}',
                kind: 'TEXT',
                orderNo: documentIndex + 1,
                content:
                    '${docs[documentIndex].$1}\n\n${docs[documentIndex].$2}',
              ),
          ],
        ),
      );
      for (var position = 0; position < 5; position++) {
        addQuestion(
          part: 7,
          orderNo: orderNo,
          type: 'SINGLE_CHOICE',
          questionText: multiSetQuestions[position],
          optionTexts: multiSetOptions[position],
          correctOption: _codes[(setIndex + position + 1) % 4],
          groupId: groupId,
          positionInGroup: position + 1,
        );
        orderNo++;
      }
    }

    questions.sort((a, b) => a.question.orderNo.compareTo(b.question.orderNo));
    groups.sort((a, b) {
      final partComparison = a.part.compareTo(b.part);
      if (partComparison != 0) return partComparison;
      return a.orderNo.compareTo(b.orderNo);
    });

    final bank = MockTestQuestionBank(
      questions: List.unmodifiable(questions),
      groups: List.unmodifiable(groups),
    );
    validateBank(bank);
    return bank;
  }

  static void validateBank(MockTestQuestionBank bank) {
    if (bank.questions.length != 200) {
      throw StateError(
        'Mock question bank must contain exactly 200 questions.',
      );
    }
    for (final entry in expectedQuestionCounts.entries) {
      final actual = bank.questions
          .where((seed) => seed.question.part == entry.key)
          .length;
      if (actual != entry.value) {
        throw StateError(
          'Part ${entry.key} must contain ${entry.value} questions; found $actual.',
        );
      }
    }
    final part3Groups = bank.groups.where((group) => group.part == 3).toList();
    final part4Groups = bank.groups.where((group) => group.part == 4).toList();
    final part6Groups = bank.groups.where((group) => group.part == 6).toList();
    final part7Groups = bank.groups.where((group) => group.part == 7).toList();
    bool hasQuestionsPerGroup(List<TestAttemptGroup> groups, int expected) =>
        groups.every(
          (group) =>
              bank.questions
                  .where((seed) => seed.question.groupId == group.groupId)
                  .length ==
              expected,
        );
    final part7Single = part7Groups
        .where((group) => group.type == 'SINGLE_PASSAGE')
        .toList();
    final part7Double = part7Groups
        .where((group) => group.type == 'DOUBLE_PASSAGE')
        .toList();
    final part7Triple = part7Groups
        .where((group) => group.type == 'TRIPLE_PASSAGE')
        .toList();
    final part7SingleQuestionCount = bank.questions
        .where(
          (seed) =>
              seed.question.part == 7 &&
              part7Single.any(
                (group) => group.groupId == seed.question.groupId,
              ),
        )
        .length;

    if (part3Groups.length != 13 ||
        !hasQuestionsPerGroup(part3Groups, 3) ||
        part4Groups.length != 10 ||
        !hasQuestionsPerGroup(part4Groups, 3) ||
        part6Groups.length != 4 ||
        !hasQuestionsPerGroup(part6Groups, 4) ||
        part7Groups.length != 15 ||
        part7Single.length != 10 ||
        part7Double.length != 3 ||
        part7Triple.length != 2 ||
        part7SingleQuestionCount != 29 ||
        !hasQuestionsPerGroup([...part7Double, ...part7Triple], 5)) {
      throw StateError(
        'Mock question bank has an invalid shared-material structure.',
      );
    }
    for (var index = 0; index < bank.questions.length; index++) {
      if (bank.questions[index].question.orderNo != index + 1) {
        throw StateError('Question order must be consecutive from 1 to 200.');
      }
    }
    for (final seed in bank.questions) {
      final codes = seed.question.options
          .map((option) => option.optionCode)
          .toSet();
      if (!codes.contains(seed.correctOption)) {
        throw StateError('Missing answer key for ${seed.question.questionId}.');
      }
    }
  }
}
