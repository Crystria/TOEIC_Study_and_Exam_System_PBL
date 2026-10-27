import type { GrammarLesson, LearningCatalog, LearningProgress, Vocabulary } from './types';

const topics: LearningCatalog['topics'] = [
  {
    id: 'business-office',
    title: 'Business & Office',
    description: 'Tự tin với những từ quen thuộc trong môi trường công sở.',
    label: 'Công việc & văn phòng',
    tone: 'blue',
  },
  {
    id: 'travel-transport',
    title: 'Travel & Transport',
    description: 'Từ sân bay đến khách sạn, sẵn sàng cho mọi hành trình.',
    label: 'Du lịch & di chuyển',
    tone: 'green',
  },
  {
    id: 'shopping-services',
    title: 'Shopping & Services',
    description: 'Hiểu thông báo, giao dịch và những tình huống mua sắm.',
    label: 'Mua sắm & dịch vụ',
    tone: 'purple',
  },
];

type WordSeed = [string, string, string, string, string, string];
const seeds: WordSeed[][] = [
  [
    [
      'appointment',
      '/əˈpɔɪntmənt/',
      'danh từ',
      'cuộc hẹn',
      'I have an appointment with the manager at ten.',
      'Tôi có cuộc hẹn với quản lý lúc mười giờ.',
    ],
    [
      'colleague',
      '/ˈkɑːliːɡ/',
      'danh từ',
      'đồng nghiệp',
      'My colleague will join the meeting.',
      'Đồng nghiệp của tôi sẽ tham gia cuộc họp.',
    ],
    [
      'deadline',
      '/ˈdedlaɪn/',
      'danh từ',
      'hạn chót',
      'The deadline for the report is Friday.',
      'Hạn chót nộp báo cáo là thứ Sáu.',
    ],
    [
      'department',
      '/dɪˈpɑːrtmənt/',
      'danh từ',
      'phòng ban',
      'She works in the sales department.',
      'Cô ấy làm việc tại phòng kinh doanh.',
    ],
    [
      'negotiate',
      '/nɪˈɡoʊʃieɪt/',
      'động từ',
      'đàm phán',
      'We need to negotiate a better price.',
      'Chúng ta cần đàm phán để có mức giá tốt hơn.',
    ],
    [
      'proposal',
      '/prəˈpoʊzəl/',
      'danh từ',
      'đề xuất',
      'The director approved our proposal.',
      'Giám đốc đã phê duyệt đề xuất của chúng tôi.',
    ],
    [
      'schedule',
      '/ˈskedʒuːl/',
      'danh từ',
      'lịch trình',
      'Please check the training schedule.',
      'Vui lòng kiểm tra lịch đào tạo.',
    ],
    [
      'supervisor',
      '/ˈsuːpərvaɪzər/',
      'danh từ',
      'người giám sát',
      'Ask your supervisor for assistance.',
      'Hãy nhờ người giám sát của bạn hỗ trợ.',
    ],
  ],
  [
    [
      'reservation',
      '/ˌrezərˈveɪʃən/',
      'danh từ',
      'sự đặt chỗ',
      'I would like to confirm my reservation.',
      'Tôi muốn xác nhận việc đặt chỗ của mình.',
    ],
    [
      'departure',
      '/dɪˈpɑːrtʃər/',
      'danh từ',
      'sự khởi hành',
      'The departure time has changed.',
      'Giờ khởi hành đã thay đổi.',
    ],
    [
      'luggage',
      '/ˈlʌɡɪdʒ/',
      'danh từ',
      'hành lý',
      'Please keep your luggage with you.',
      'Vui lòng giữ hành lý bên mình.',
    ],
    [
      'destination',
      '/ˌdestɪˈneɪʃən/',
      'danh từ',
      'điểm đến',
      'Paris is our final destination.',
      'Paris là điểm đến cuối cùng của chúng tôi.',
    ],
    [
      'itinerary',
      '/aɪˈtɪnəreri/',
      'danh từ',
      'kế hoạch hành trình',
      'The travel agent emailed the itinerary.',
      'Đại lý du lịch đã gửi kế hoạch hành trình qua email.',
    ],
    [
      'commute',
      '/kəˈmjuːt/',
      'động từ',
      'đi lại hằng ngày',
      'Many employees commute by train.',
      'Nhiều nhân viên đi làm bằng tàu.',
    ],
    [
      'accommodation',
      '/əˌkɑːməˈdeɪʃən/',
      'danh từ',
      'chỗ ở',
      'The company will arrange accommodation.',
      'Công ty sẽ sắp xếp chỗ ở.',
    ],
    [
      'boarding',
      '/ˈbɔːrdɪŋ/',
      'danh từ',
      'việc lên máy bay',
      'Boarding will begin in ten minutes.',
      'Việc lên máy bay sẽ bắt đầu sau mười phút.',
    ],
  ],
  [
    [
      'receipt',
      '/rɪˈsiːt/',
      'danh từ',
      'biên lai',
      'Keep your receipt for a refund.',
      'Hãy giữ biên lai để được hoàn tiền.',
    ],
    [
      'discount',
      '/ˈdɪskaʊnt/',
      'danh từ',
      'khoản giảm giá',
      'Members receive a ten percent discount.',
      'Thành viên được giảm giá mười phần trăm.',
    ],
    [
      'refund',
      '/ˈriːfʌnd/',
      'danh từ',
      'khoản hoàn tiền',
      'You can request a refund within seven days.',
      'Bạn có thể yêu cầu hoàn tiền trong vòng bảy ngày.',
    ],
    [
      'warranty',
      '/ˈwɔːrənti/',
      'danh từ',
      'bảo hành',
      'The laptop comes with a one-year warranty.',
      'Máy tính xách tay đi kèm bảo hành một năm.',
    ],
    [
      'purchase',
      '/ˈpɜːrtʃəs/',
      'động từ',
      'mua hàng',
      'Customers can purchase tickets online.',
      'Khách hàng có thể mua vé trực tuyến.',
    ],
    [
      'delivery',
      '/dɪˈlɪvəri/',
      'danh từ',
      'sự giao hàng',
      'Free delivery is available this week.',
      'Tuần này có dịch vụ giao hàng miễn phí.',
    ],
    [
      'available',
      '/əˈveɪləbəl/',
      'tính từ',
      'có sẵn',
      'This product is available in three colors.',
      'Sản phẩm này có sẵn ba màu.',
    ],
    [
      'customer',
      '/ˈkʌstəmər/',
      'danh từ',
      'khách hàng',
      'Customer satisfaction is our priority.',
      'Sự hài lòng của khách hàng là ưu tiên của chúng tôi.',
    ],
  ],
];

const words: Vocabulary[] = seeds.flatMap((group, topicIndex) =>
  group.map(([word, phonetic, wordClass, definition, example, translation]) => ({
    id: word,
    topicId: topics[topicIndex].id,
    word,
    phonetic,
    wordClass,
    definition,
    example,
    translation,
    audioUrl: `/demo/audio/vocabulary-${word}.mp3`,
  })),
);

const lessons: GrammarLesson[] = [
  {
    id: 'present-perfect',
    title: 'Thì hiện tại hoàn thành',
    category: 'Các thì trong tiếng Anh',
    level: 'Cơ bản',
    summary: 'Nối một sự việc trong quá khứ với hiện tại. Phân biệt since, for, already và yet.',
    contentMarkdown: `## Khi nào dùng hiện tại hoàn thành?

Thì hiện tại hoàn thành diễn tả một trải nghiệm, một kết quả còn liên quan đến hiện tại hoặc một hành động bắt đầu trong quá khứ và vẫn tiếp tục.

> Hãy chú ý mối liên hệ với hiện tại, thay vì chỉ tìm một từ khóa trong câu.

## Công thức cần nhớ

| Dạng câu | Cấu trúc | Ví dụ |
| --- | --- | --- |
| Khẳng định | S + have/has + V3 | She has finished the report. |
| Phủ định | S + have/has not + V3 | They have not received the invoice. |
| Nghi vấn | Have/Has + S + V3? | Have you booked the meeting room? |

**Have** đi với I, you, we, they. **Has** đi với he, she, it. V3 là quá khứ phân từ của động từ.

## Dấu hiệu thường gặp trong TOEIC

- **Since** + mốc thời gian: since 2020, since Monday.
- **For** + khoảng thời gian: for three years, for two weeks.
- **Already** thường đứng trước V3 trong câu khẳng định.
- **Yet** thường ở cuối câu hỏi hoặc câu phủ định.
- **Just**, **ever**, **never** cũng thường xuất hiện với thì này.

### Ví dụ trong môi trường công sở

**Ms. Kim has worked in this department for five years.**

Bà Kim đã làm việc ở phòng ban này được năm năm và hiện vẫn còn làm ở đây.

**We have not confirmed the schedule yet.**

Chúng tôi vẫn chưa xác nhận lịch trình tính đến hiện tại.

## Phân biệt với quá khứ đơn

Khi câu nêu thời điểm quá khứ đã kết thúc như **yesterday** hoặc **last Friday**, thường dùng quá khứ đơn.

- We **sent** the proposal yesterday. → Có thời điểm đã kết thúc.
- We **have sent** the proposal. → Nhấn mạnh kết quả: đề xuất đã được gửi.

## Tự kiểm tra trước khi kết thúc

1. Bạn có chọn đúng have hoặc has theo chủ ngữ không?
2. Động từ đã ở dạng V3 chưa?
3. Câu có mốc thời gian quá khứ đã kết thúc không?

Ghi nhớ: ngữ cảnh quyết định cách dùng thì; từ khóa chỉ là một gợi ý.`,
  },
  {
    id: 'present-simple',
    title: 'Thì hiện tại đơn',
    category: 'Các thì trong tiếng Anh',
    level: 'Cơ bản',
    summary: 'Diễn đạt thói quen, sự thật và lịch trình cố định trong công việc.',
    contentMarkdown: `## Cách dùng

Hiện tại đơn dùng cho thói quen, sự thật và lịch trình cố định.

- The store **opens** at nine every morning.
- Our team **meets** on Mondays.

## Công thức

| Dạng | Động từ thường | Ví dụ |
| --- | --- | --- |
| Khẳng định | S + V/V-s/es | She checks her email daily. |
| Phủ định | S + do/does not + V | He does not work on Sundays. |
| Nghi vấn | Do/Does + S + V? | Does the train stop here? |

## Chủ ngữ và động từ

Với he, she, it, động từ thường thêm **s/es** trong câu khẳng định. Sau does hoặc does not, dùng động từ nguyên mẫu.

> Đúng: She does not work here. Sai: She does not works here.

## Dấu hiệu và ví dụ TOEIC

Các trạng từ **usually**, **often**, **always**, **sometimes** thường đi trước động từ thường và sau động từ be.

**The reception desk is always busy in the morning.**

Quầy lễ tân luôn bận rộn vào buổi sáng.

## Ôn lại

Hãy tìm chủ ngữ, xác định động từ và kiểm tra xem câu mô tả thói quen hay một việc đang diễn ra.`,
  },
  {
    id: 'word-forms',
    title: 'Nhận diện từ loại',
    category: 'Từ loại & cấu trúc câu',
    level: 'Cơ bản',
    summary: 'Nhìn vị trí trống để chọn danh từ, động từ, tính từ hoặc trạng từ trong Part 5.',
    contentMarkdown: `## Bắt đầu từ vị trí trong câu

Trong câu hỏi từ loại, các phương án thường cùng một gốc từ. Hãy xác định vai trò của chỗ trống trước khi dịch nghĩa.

## Bốn nhóm từ loại

| Từ loại | Vai trò thường gặp | Ví dụ |
| --- | --- | --- |
| Danh từ | Chủ ngữ hoặc tân ngữ | decision, development |
| Động từ | Diễn tả hành động hoặc trạng thái | decide, develop |
| Tính từ | Bổ nghĩa cho danh từ | successful, careful |
| Trạng từ | Bổ nghĩa cho động từ, tính từ | successfully, carefully |

## Ví dụ Part 5

The manager reviewed the proposal **carefully**.

Chỗ trống bổ nghĩa cho hành động reviewed nên dùng trạng từ.

The company announced a **successful** partnership.

Chỗ trống đứng trước danh từ partnership nên dùng tính từ.

## Các bước làm bài

1. Tìm chủ ngữ và động từ chính.
2. Xem từ đứng trước và sau vị trí trống.
3. Xác định từ loại cần điền.
4. Đọc lại toàn câu để kiểm tra nghĩa.

> Đuôi từ là gợi ý, không phải quy tắc tuyệt đối. Friendly là tính từ dù kết thúc bằng -ly.`,
  },
  {
    id: 'passive-voice',
    title: 'Câu bị động trong công việc',
    category: 'Từ loại & cấu trúc câu',
    level: 'Trung cấp',
    summary: 'Đưa đối tượng nhận hành động lên đầu câu; chọn đúng be và quá khứ phân từ.',
    contentMarkdown: `## Vì sao dùng câu bị động?

Câu bị động nhấn mạnh đối tượng chịu tác động, đặc biệt khi người thực hiện không quan trọng hoặc chưa biết.

## Cấu trúc chính

**S + be + V3 (+ by + người thực hiện)**

| Thì | Dạng bị động | Ví dụ |
| --- | --- | --- |
| Hiện tại đơn | am/is/are + V3 | Orders are processed daily. |
| Quá khứ đơn | was/were + V3 | The package was delivered yesterday. |
| Hiện tại hoàn thành | have/has been + V3 | The contract has been signed. |
| Tương lai đơn | will be + V3 | The results will be announced soon. |

## Chuyển đổi câu

- Chủ động: The manager approved the proposal.
- Bị động: The proposal was approved by the manager.

## Lưu ý khi làm TOEIC

Kiểm tra xem chủ ngữ **thực hiện** hay **nhận** hành động. Sau đó xác định thì qua ngữ cảnh để chọn dạng be phù hợp.

> Không phải mọi động từ đều chuyển được sang bị động. Cần có tân ngữ trong cách dùng tương ứng.`,
  },
  {
    id: 'conditionals',
    title: 'Câu điều kiện loại 1 và 2',
    category: 'Mệnh đề & liên từ',
    level: 'Trung cấp',
    summary: 'Phân biệt điều kiện có thể xảy ra và tình huống giả định ở hiện tại.',
    contentMarkdown: `## Điều kiện loại 1

**If + S + hiện tại đơn, S + will + V.**

If you place the order today, we will deliver it tomorrow.

Đây là một điều kiện có thể xảy ra trong tương lai.

## Điều kiện loại 2

**If + S + quá khứ đơn, S + would + V.**

If we had a larger budget, we would hire more employees.

Đây là tình huống giả định, khó xảy ra hoặc không đúng ở hiện tại.

## So sánh

| Loại | Ý nghĩa | Mệnh đề chính |
| --- | --- | --- |
| 1 | Khả năng thực tế | will + V |
| 2 | Giả định hiện tại/tương lai | would + V |

## Tránh lỗi thường gặp

- Với cấu trúc loại 1 cơ bản, không dùng will trong mệnh đề if.
- Với loại 2, không dùng would trong mệnh đề if ở cấu trúc cơ bản.
- Khi mệnh đề if đứng đầu, dùng dấu phẩy ngăn cách hai mệnh đề.

> Hãy xét mức độ thực tế của tình huống trước khi chọn công thức.`,
  },
  {
    id: 'relative-clauses',
    title: 'Mệnh đề quan hệ',
    category: 'Mệnh đề & liên từ',
    level: 'Trung cấp',
    summary: 'Dùng who, which, that và whose để bổ sung thông tin cho danh từ.',
    contentMarkdown: `## Vai trò của mệnh đề quan hệ

Mệnh đề quan hệ bổ nghĩa cho danh từ đứng trước nó, giúp xác định người hoặc vật đang được nhắc đến.

## Đại từ quan hệ

| Đại từ | Chỉ đối tượng | Ví dụ |
| --- | --- | --- |
| who | Người | The employee who joined yesterday is an accountant. |
| which | Vật | The printer which we ordered has arrived. |
| that | Người hoặc vật trong mệnh đề xác định | The report that you requested is ready. |
| whose | Sở hữu | The client whose order was delayed called us. |

## Xác định và không xác định

Mệnh đề xác định cung cấp thông tin cần thiết để biết đang nói đến ai hoặc vật gì. Không dùng dấu phẩy ngăn cách.

Mệnh đề không xác định thêm thông tin phụ và được ngăn bằng dấu phẩy. **Không dùng that** trong mệnh đề không xác định.

## Cách tiếp cận câu TOEIC

1. Tìm danh từ được bổ nghĩa.
2. Xác định đó là người hay vật.
3. Kiểm tra vị trí trống cần chủ ngữ, tân ngữ hay sở hữu.
4. Quan sát dấu phẩy và nghĩa toàn câu.`,
  },
];

export function createLearningCatalog(empty = false): LearningCatalog {
  return structuredClone({
    topics: empty ? [] : topics,
    words: empty ? [] : words,
    lessons: empty ? [] : lessons,
    dailyVocabularyGoal: 10,
  });
}

export function createLearningProgress(catalog: LearningCatalog, now: string): LearningProgress {
  const progress: LearningProgress = {
    version: 1,
    revision: 0,
    vocabulary: {},
    lessons: {},
    session: null,
  };
  for (const word of catalog.words
    .filter((word) => word.topicId === 'business-office')
    .slice(0, 5)) {
    progress.vocabulary[word.id] = {
      quality: 3,
      intervalDays: 1,
      easinessFactor: 2.36,
      repetition: 1,
      lastReviewAt: new Date(Date.parse(now) - 2 * 86400000).toISOString(),
      nextReviewAt: new Date(Date.parse(now) - 86400000).toISOString(),
    };
  }
  if (catalog.lessons.some((lesson) => lesson.id === 'present-simple'))
    progress.lessons['present-simple'] = new Date(Date.parse(now) - 86400000).toISOString();
  return progress;
}
