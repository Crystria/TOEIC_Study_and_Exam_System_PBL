const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

// Run against the Student app in API mode. The browser serves every API response.
const base = process.env.WEB_QA_URL || 'http://localhost:3006';
const sessionId = 'qa-vocabulary-round';
const topicId = 'qa-business-vocabulary';
const roundPath = `/api/frontend/learning/flashcard-sessions/${sessionId}`;
const learner = {
  id: 'qa-student',
  email: 'student@example.invalid',
  fullName: 'Tài khoản kiểm thử',
  status: 'ACTIVE',
  roles: ['USER'],
  phoneNumber: null,
  avatarUrl: null,
};
const vocabularies = [
  {
    vocabularyId: 'qa-goods',
    topicId,
    word: 'goods',
    partOfSpeech: 'noun',
    phonetic: '/ɡʊdz/',
    definition: 'hàng hóa, mặt hàng',
    audioUrl: 'https://example.invalid/unused-goods.mp3',
  },
  {
    vocabularyId: 'qa-refund',
    topicId,
    word: 'refund',
    partOfSpeech: 'verb',
    phonetic: '/rɪˈfʌnd/',
    definition: 'hoàn tiền',
  },
];
const quiz = vocabularies.map(({ vocabularyId, word }, index) => ({
  questionId: `question-${index + 1}`,
  vocabularyId,
  prompt: word,
  direction: 'WORD_TO_MEANING',
  options: (index === 0
    ? ['hàng hóa, mặt hàng', 'nhân viên bán hàng', 'buổi hội thảo', 'hoàn tiền']
    : ['hàng hóa, mặt hàng', 'hóa đơn', 'lịch trình', 'hoàn tiền']
  ).map((text, option) => ({ code: 'ABCD'[option], text })),
}));
const reviews = vocabularies.map(({ vocabularyId }) => ({ vocabularyId, quality: 5 }));

async function run() {
  const posts = [];
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  try {
    const viewport = { width: 360, height: 800 };
    const page = await browser.newPage({ viewport });
    await page.route('**/api/frontend/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      const method = route.request().method();
      if (method === 'GET' && path === '/api/frontend/auth/session')
        return route.fulfill({ json: { user: learner } });
      if (method === 'GET' && path === roundPath)
        return route.fulfill({
          json: { sessionId, topicId, status: 'IN_PROGRESS', vocabularies, quiz, reviews },
        });
      if (method !== 'POST' || path !== `${roundPath}/submit`) return route.abort();

      const body = route.request().postDataJSON();
      posts.push(body);
      const answers = body.answers.map((answer) => {
        const correctOption = answer.questionId === 'question-1' ? 'A' : 'D';
        return { ...answer, correctOption, isCorrect: answer.selectedOption === correctOption };
      });
      return route.fulfill({
        json: {
          sessionId,
          status: 'COMPLETED',
          quizScore: answers.filter((answer) => answer.isCorrect).length,
          quizTotal: answers.length,
          answers,
        },
      });
    });

    const card = page.locator('.quiz-question');
    const button = (name) => page.getByRole('button', { name, exact: true });
    const option = (name) => card.getByRole('radio', { name });
    const choose = (text) => card.locator('.quiz-option').filter({ hasText: text }).click();
    const previous = button('Câu trước');
    const next = button('Tiếp theo');
    const submit = button('Nộp quiz');

    await page.goto(`${base}/study/vocabulary/${topicId}?flashcardSession=${sessionId}`);
    await card.getByText('goods', { exact: true }).waitFor();
    assert.equal(await card.count(), 1);
    assert.equal(await card.getByRole('radio').count(), 4);
    assert.equal(await page.locator('audio').count(), 0);
    assert.equal(
      await page.getByRole('button', { name: /Ôn tập|Đã biết|Phát âm|Nghe/ }).count(),
      0,
    );
    assert.equal(await previous.isDisabled(), true);
    assert.equal(await next.isDisabled(), true);
    assert.equal(await submit.count(), 0);

    for (const control of await card.locator('.quiz-option').all()) {
      const bounds = await control.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= viewport.width);
    }

    await choose('nhân viên bán hàng');
    assert.equal(await next.isEnabled(), true);
    await next.click();
    await card.getByText('refund', { exact: true }).waitFor();
    assert.equal(await card.getByText('goods', { exact: true }).count(), 0);
    assert.equal(await option('lịch trình').count(), 1);
    assert.equal(await submit.isDisabled(), true);
    await choose('lịch trình');

    await previous.click();
    assert.equal(await option('nhân viên bán hàng').isChecked(), true);
    await choose('hàng hóa, mặt hàng');
    assert.equal(await option('hàng hóa, mặt hàng').isChecked(), true);
    await next.click();
    assert.equal(posts.length, 0, 'Navigating to the last question must not submit the quiz');
    assert.equal(await option('lịch trình').isChecked(), true);

    await submit.click();
    await page.getByRole('heading', { name: 'Kết quả quiz', exact: true }).waitFor();
    await page.getByText('1 / 2 câu đúng', { exact: true }).waitFor();
    assert.equal(posts.length, 1);
    assert.ok(posts[0].operationId);
    assert.deepEqual(posts[0].reviews, reviews);
    assert.deepEqual(posts[0].answers, [
      { questionId: 'question-1', selectedOption: 'A' },
      { questionId: 'question-2', selectedOption: 'C' },
    ]);
    console.log('PASS Student vocabulary quiz navigation, editing, scoring, and mobile layout');
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
