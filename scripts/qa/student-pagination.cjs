const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

// Run against the Student app in API mode. The browser serves all API fixtures.
const base = process.env.WEB_QA_URL || 'http://localhost:3006';
const size = 2;
const category = 'Tenses';
const lessons = ['Present simple', 'Present continuous', 'Past simple'].map((title, index) => ({
  lessonId: `00000000-0000-4000-8000-00000000000${index + 1}`,
  lessonTitle: title,
  category,
  contentMarkdown: `# ${title}`,
  status: 'PUBLISHED',
}));
const student = {
  id: '00000000-0000-4000-8000-000000000004',
  email: 'student@example.invalid',
  fullName: 'Tài khoản kiểm thử',
  status: 'ACTIVE',
  roles: ['USER'],
  phoneNumber: null,
  avatarUrl: null,
};

async function run() {
  const requests = [];
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  try {
    const browserPage = await browser.newPage();
    await browserPage.route('**/api/frontend/**', async (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() !== 'GET') return route.abort();
      if (url.pathname === '/api/frontend/auth/session')
        return route.fulfill({ json: { user: student } });
      if (url.pathname !== '/api/frontend/learning/lessons') return route.abort();

      const page = Number(url.searchParams.get('page') ?? '1');
      const keyword = url.searchParams.get('keyword') ?? '';
      const categoryFilter = url.searchParams.get('category');
      requests.push({ page, keyword, category: categoryFilter });
      const matches = lessons.filter(
        (lesson) => lesson.category === categoryFilter && lesson.lessonTitle.includes(keyword),
      );
      return route.fulfill({
        json: {
          items: matches.slice((page - 1) * size, page * size),
          total: matches.length,
          page,
          size,
        },
      });
    });

    const goToLibrary = (page) =>
      browserPage.goto(`${base}/study/grammar?category=${category}&page=${page}`);
    const pager = browserPage.getByRole('navigation', { name: 'Phân trang', exact: true });
    const button = (name) => pager.getByRole('button', { name, exact: true });
    const lesson = (title) =>
      browserPage.getByRole('link', { name: `Xem bài: ${title}`, exact: true });
    const expectRequest = (page, keyword = '') =>
      assert.deepEqual(requests.at(-1), { page, keyword, category });

    await goToLibrary(1);
    await lesson('Present simple').waitFor();
    expectRequest(1);
    assert.equal(await button('Trang 1').getAttribute('aria-current'), 'page');
    assert.equal(await button('Trang trước').isDisabled(), true);
    assert.equal(await button('Trang 3').count(), 0);

    await button('Trang 2').click();
    await lesson('Past simple').waitFor();
    expectRequest(2);
    assert.equal(await lesson('Present simple').count(), 0);
    assert.equal(await button('Trang 2').getAttribute('aria-current'), 'page');
    assert.equal(await button('Trang sau').isDisabled(), true);

    await button('Trang trước').click();
    await lesson('Present simple').waitFor();
    expectRequest(1);
    await browserPage.goBack();
    await lesson('Past simple').waitFor();
    expectRequest(2);

    await browserPage.getByRole('searchbox', { name: 'Từ khóa' }).fill('continuous');
    await browserPage.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
    await lesson('Present continuous').waitFor();
    expectRequest(1, 'continuous');
    assert.equal(await lesson('Present simple').count(), 0);
    assert.equal(await pager.count(), 0);

    const mobile = { width: 320, height: 740 };
    await browserPage.setViewportSize(mobile);
    await goToLibrary(9);
    await lesson('Past simple').waitFor();
    assert.ok(requests.some((request) => request.page === 9 && request.category === category));
    expectRequest(2);
    assert.equal(new URL(browserPage.url()).searchParams.get('page'), '2');
    await pager.scrollIntoViewIfNeeded();
    for (const control of await pager.getByRole('button').all()) {
      const bounds = await control.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= mobile.width);
    }

    console.log('PASS Student API pagination, filters, out-of-range recovery, and mobile layout');
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
