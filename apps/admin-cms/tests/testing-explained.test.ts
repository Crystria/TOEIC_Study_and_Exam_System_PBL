import assert from 'node:assert/strict';
import test from 'node:test';
import { readTestParams, selectTestPage } from '../src/lib/tests/query';
import { formatTestDuration, type TestQuery, type TestSummary } from '../src/lib/tests/types';

// Independent oracles: literal UI contract defaults, NOT DEFAULT_TEST_QUERY or SUT output.
const baseQuery: TestQuery = { keyword: '', type: '', status: '', page: 1, size: 20 };
const expectedUrl = (
  query: Partial<TestQuery> = {},
  corrected = false,
  role = 'CONTENT_ADMIN',
  preview = 'normal',
) => ({ query: { ...baseQuery, ...query }, preview, role, corrected });

export const urlCases = [
  {
    id: 'URL-01',
    raw: '',
    expected: expectedUrl(),
    area: 'U1',
    why: 'Không có tham số: dùng đúng toàn bộ mặc định.',
  },
  {
    id: 'URL-02',
    raw: 'keyword=%20Giao+ti%E1%BA%BFp%20&type=MINI&status=PUBLISHED&page=2&size=3&demoRole=SYSTEM_ADMIN&testPreview=slow',
    expected: expectedUrl(
      { keyword: 'Giao tiếp', type: 'MINI', status: 'PUBLISHED', page: 2, size: 3 },
      false,
      'SYSTEM_ADMIN',
      'slow',
    ),
    area: 'U2,U4,U6',
    why: 'Bộ lọc đồng thời, Unicode, trim và size hợp lệ ngoài gợi ý dropdown.',
  },
  {
    id: 'URL-03',
    raw: 'keyword=&type=&status=&page=&size=&demoRole=&testPreview=',
    expected: expectedUrl(),
    area: 'U1',
    why: 'Chuỗi rỗng là bỏ chọn/dùng mặc định, không phải lỗi.',
  },
  {
    id: 'URL-04',
    raw: 'keyword=A&keyword=B&status=DRAFT',
    expected: expectedUrl({ status: 'DRAFT' }, true),
    area: 'U3',
    why: 'Keyword lặp bị bỏ; trường status độc lập phải giữ nguyên.',
  },
  {
    id: 'URL-05',
    raw: 'page=2&page=3&size=3',
    expected: expectedUrl({ size: 3 }, true),
    area: 'U3',
    why: 'Không tự chọn page đầu/cuối khi tham số mơ hồ.',
  },
  {
    id: 'URL-06',
    raw: 'type=FULL&type=FULL',
    expected: expectedUrl({}, true),
    area: 'U3',
    why: 'Lặp cùng giá trị vẫn là lặp, không được chấp nhận nhầm.',
  },
  {
    id: 'URL-07',
    raw: 'type=FULL_TEST&status=ACTIVE&demoRole=ADMIN&testPreview=fast',
    expected: expectedUrl({}, true),
    area: 'U5',
    why: 'Không trộn enum Word, trạng thái tài khoản, vai trò hoặc preview lạ vào catalog.',
  },
  {
    id: 'URL-08',
    raw: 'type=FULL&status=DRAFT&demoRole=CONTENT_ADMIN&testPreview=normal',
    expected: expectedUrl({ type: 'FULL', status: 'DRAFT' }),
    area: 'U4',
    why: 'Kiểm lựa chọn enum hợp lệ đầu tiên và nhánh preview mặc định tường minh.',
  },
  {
    id: 'URL-09',
    raw: 'type=MINI&status=ARCHIVED&demoRole=SYSTEM_ADMIN&testPreview=empty',
    expected: expectedUrl({ type: 'MINI', status: 'ARCHIVED' }, false, 'SYSTEM_ADMIN', 'empty'),
    area: 'U4',
    why: 'Các lựa chọn còn lại phải giữ được nguyên giá trị.',
  },
  {
    id: 'URL-10',
    raw: 'testPreview=error',
    expected: expectedUrl({}, false, 'CONTENT_ADMIN', 'error'),
    area: 'U4',
    why: 'error là kịch bản demo hợp lệ, không phải lỗi parser.',
  },
  {
    id: 'URL-11',
    raw: 'debug=true&token=illustration-only',
    expected: expectedUrl(),
    area: 'U9',
    why: 'Khóa ngoài danh sách không xuất hiện trong query trả về.',
  },
  {
    id: 'URL-12',
    raw: 'page=0002&size=03',
    expected: expectedUrl({ page: 2, size: 3 }),
    area: 'U6',
    why: 'Chữ số có zero đầu vẫn là biểu diễn số nguyên được chấp nhận.',
  },
  {
    id: 'URL-13',
    raw: 'keyword=+++',
    expected: expectedUrl(),
    area: 'U2',
    why: 'Keyword chỉ có dấu cách được trim về chuỗi rỗng, không báo corrected.',
  },
  {
    id: 'URL-14',
    raw: 'size=0',
    expected: expectedUrl({}, true),
    area: 'U7;size min-1',
    why: 'Bắt lỗi cho phép kích thước trang bằng 0, có thể gây chia cho 0.',
  },
  {
    id: 'URL-15',
    raw: 'size=1',
    expected: expectedUrl({ size: 1 }),
    area: 'U6;size min',
    why: 'Biên dưới phải được bao gồm.',
  },
  {
    id: 'URL-16',
    raw: 'size=2',
    expected: expectedUrl({ size: 2 }),
    area: 'U6;size min+1',
    why: 'Giá trị ngay trong miền hợp lệ cạnh biên dưới.',
  },
  {
    id: 'URL-17',
    raw: 'size=49',
    expected: expectedUrl({ size: 49 }),
    area: 'U6;size max-1',
    why: 'Không được thu hẹp giới hạn trên thành 49 hoặc chỉ cho dropdown.',
  },
  {
    id: 'URL-18',
    raw: 'size=50',
    expected: expectedUrl({ size: 50 }),
    area: 'U6;size max',
    why: 'Bắt lỗi dùng >= 50 thay vì > 50.',
  },
  {
    id: 'URL-19',
    raw: 'size=51',
    expected: expectedUrl({}, true),
    area: 'U7;size max+1',
    why: 'Vượt giới hạn phải về 20, không clamp thành 50.',
  },
  {
    id: 'URL-20',
    raw: 'page=0',
    expected: expectedUrl({}, true),
    area: 'U7;page min-1',
    why: 'Trang đánh số từ 1; 0 phải về 1 và báo sửa.',
  },
  {
    id: 'URL-21',
    raw: 'page=1',
    expected: expectedUrl(),
    area: 'U6;page min',
    why: 'Cùng page kết quả với case 0 nhưng corrected phải khác.',
  },
  {
    id: 'URL-22',
    raw: 'page=2',
    expected: expectedUrl({ page: 2 }),
    area: 'U6;page min+1',
    why: 'Parser không biết tổng trang nên không tự đưa trang 2 về 1.',
  },
  {
    id: 'URL-23',
    raw: 'page=9007199254740990',
    expected: expectedUrl({ page: 9007199254740990 }),
    area: 'U6;safe max-1',
    why: 'Số nguyên an toàn ngay dưới giới hạn JavaScript.',
  },
  {
    id: 'URL-24',
    raw: 'page=9007199254740991',
    expected: expectedUrl({ page: 9007199254740991 }),
    area: 'U6;safe max',
    why: 'MAX_SAFE_INTEGER được bao gồm, chưa clamp theo dữ liệu.',
  },
  {
    id: 'URL-25',
    raw: 'page=9007199254740992',
    expected: expectedUrl({}, true),
    area: 'U7;safe max+1',
    why: 'Không giữ số vượt miền nguyên an toàn dù chuỗi chỉ có chữ số.',
  },
  {
    id: 'URL-26',
    raw: 'page=-1',
    expected: expectedUrl({}, true),
    area: 'U8',
    why: 'Số âm không phải trang hợp lệ và có dấu ngoài định dạng chữ số.',
  },
  {
    id: 'URL-27',
    raw: 'size=1.5',
    expected: expectedUrl({}, true),
    area: 'U8',
    why: 'Không làm tròn số thực thành số nguyên hợp lệ.',
  },
  {
    id: 'URL-28',
    raw: 'page=1e2',
    expected: expectedUrl({}, true),
    area: 'U8',
    why: 'Number có thể đọc 1e2 nhưng contract URL chỉ nhận chữ số.',
  },
  {
    id: 'URL-29',
    raw: 'size=+2+',
    expected: expectedUrl({}, true),
    area: 'U8',
    why: 'URLSearchParams giải mã + thành dấu cách; không trim số như keyword.',
  },
  {
    id: 'URL-30',
    raw: 'page=Infinity',
    expected: expectedUrl({}, true),
    area: 'U8',
    why: 'Không cho giá trị vô hạn đi vào phép tính phân trang.',
  },
  {
    id: 'URL-31',
    raw: 'size=10&size=20',
    expected: expectedUrl({}, true),
    area: 'U3',
    why: 'Kích thước lặp về mặc định 20 nhưng vẫn phải có corrected=true.',
  },
];

// Small, hand-authored catalog; no shared production fixture or student data.
export const catalog: readonly TestSummary[] = Object.freeze([
  Object.freeze({
    id: 'A',
    title: 'Giao tiếp',
    type: 'FULL' as const,
    durationSeconds: 7200,
    questionCount: 200,
    status: 'PUBLISHED' as const,
  }),
  Object.freeze({
    id: 'B',
    title: 'Giao tiếp',
    type: 'MINI' as const,
    durationSeconds: 1800,
    questionCount: null,
    status: 'DRAFT' as const,
  }),
  Object.freeze({
    id: 'C',
    title: 'GIAO TIẾP nâng cao',
    type: 'MINI' as const,
    durationSeconds: 1800,
    questionCount: null,
    status: 'PUBLISHED' as const,
  }),
  Object.freeze({
    id: 'D',
    title: 'Đọc hiểu',
    type: 'FULL' as const,
    durationSeconds: 7200,
    questionCount: 200,
    status: 'ARCHIVED' as const,
  }),
  Object.freeze({
    id: 'E',
    title: 'Giao tiếp mở rộng',
    type: 'MINI' as const,
    durationSeconds: null,
    questionCount: null,
    status: null,
  }),
]);
interface PageCase {
  id: string;
  inputIds: string[];
  query: TestQuery;
  expected: {
    ids: string[];
    total: number;
    catalogTotal: number;
    page: number;
    size: number;
    totalPages: number;
  };
  area: string;
  why: string;
}
const pageQuery = (overrides: Partial<TestQuery> = {}): TestQuery => ({
  ...baseQuery,
  size: 2,
  ...overrides,
});
const pageExpected = (
  ids: string[],
  total: number,
  page: number,
  totalPages: number,
  catalogTotal = 5,
  size = 2,
) => ({ ids, total, catalogTotal, page, size, totalPages });
export const pageCases: PageCase[] = [
  {
    id: 'PAGE-01',
    inputIds: ['A', 'B', 'C', 'D', 'E'],
    query: pageQuery(),
    expected: pageExpected(['A', 'B'], 5, 1, 3),
    area: 'P1,P3;page min',
    why: 'Trang đầu giữ thứ tự, lấy đúng hai phần tử.',
  },
  {
    id: 'PAGE-02',
    inputIds: ['A', 'B', 'C', 'D', 'E'],
    query: pageQuery({ page: 2 }),
    expected: pageExpected(['C', 'D'], 5, 2, 3),
    area: 'P3;page last-1',
    why: 'Bắt lỗi lệch chỉ số bắt đầu/kết thúc trang giữa.',
  },
  {
    id: 'PAGE-03',
    inputIds: ['A', 'B', 'C', 'D', 'E'],
    query: pageQuery({ page: 3 }),
    expected: pageExpected(['E'], 5, 3, 3),
    area: 'P3;page last',
    why: 'Trang cuối thiếu phần tử vẫn phải giữ E, không làm rơi.',
  },
  {
    id: 'PAGE-04',
    inputIds: ['A', 'B', 'C', 'D', 'E'],
    query: pageQuery({ page: 4 }),
    expected: pageExpected(['E'], 5, 3, 3),
    area: 'P4;page last+1',
    why: 'Trang vượt dữ liệu phải về trang cuối, không về trang đầu/rỗng.',
  },
  {
    id: 'PAGE-05',
    inputIds: ['A', 'B', 'C', 'D', 'E'],
    query: pageQuery({ keyword: 'không tồn tại', page: 9 }),
    expected: pageExpected([], 0, 1, 1),
    area: 'P5',
    why: 'Không khớp bộ lọc khác catalog trống: catalogTotal vẫn là 5.',
  },
  {
    id: 'PAGE-06',
    inputIds: [],
    query: pageQuery({ page: 9 }),
    expected: pageExpected([], 0, 1, 1, 0),
    area: 'P6;length 0',
    why: 'Không có dữ liệu vẫn có quy ước trang 1/1 và total=0.',
  },
  {
    id: 'PAGE-07',
    inputIds: ['A', 'B', 'C', 'D', 'E'],
    query: pageQuery({ keyword: 'GIAO TIẾP', type: 'MINI', status: 'PUBLISHED' }),
    expected: pageExpected(['C'], 1, 1, 1),
    area: 'P2',
    why: 'AND ba điều kiện: A sai type, B sai status, E status null phải bị loại.',
  },
  {
    id: 'PAGE-08',
    inputIds: ['A', 'B', 'C', 'D', 'E'],
    query: pageQuery({ keyword: 'giao tiếp' }),
    expected: pageExpected(['A', 'B'], 4, 1, 2),
    area: 'P2',
    why: 'Không phân biệt hoa/thường; đếm cả C/E dù chúng ở trang khác.',
  },
  {
    id: 'PAGE-09',
    inputIds: ['A', 'B', 'C', 'D', 'E'],
    query: pageQuery({ type: 'FULL' }),
    expected: pageExpected(['A', 'D'], 2, 1, 1),
    area: 'P2',
    why: 'Chỉ lọc type, không vô tình áp status mặc định.',
  },
  {
    id: 'PAGE-10',
    inputIds: ['A', 'B', 'C', 'D', 'E'],
    query: pageQuery({ status: 'DRAFT' }),
    expected: pageExpected(['B'], 1, 1, 1),
    area: 'P2',
    why: 'Chỉ lọc status, không vô tình áp type mặc định.',
  },
  {
    id: 'PAGE-11',
    inputIds: ['A', 'B', 'C', 'D', 'E'],
    query: pageQuery({ type: 'FULL', status: 'DRAFT' }),
    expected: pageExpected([], 0, 1, 1),
    area: 'P5',
    why: 'Hai giá trị riêng đều hợp lệ nhưng tổ hợp không có bản ghi; bắt nhầm AND thành OR.',
  },
  {
    id: 'PAGE-12',
    inputIds: ['A', 'B', 'C', 'D', 'E'],
    query: pageQuery({ type: 'MINI' }),
    expected: pageExpected(['B', 'C'], 3, 1, 2),
    area: 'P2,P7',
    why: 'Status trống phải cho cả bản ghi E có status null vào tổng.',
  },
  {
    id: 'PAGE-13',
    inputIds: ['A', 'B', 'C', 'D', 'E'],
    query: pageQuery({ keyword: 'giao tiep' }),
    expected: pageExpected([], 0, 1, 1),
    area: 'P5',
    why: 'Lowercase không xóa dấu; không hứa tìm kiếm không dấu.',
  },
  {
    id: 'PAGE-14',
    inputIds: ['A'],
    query: pageQuery(),
    expected: pageExpected(['A'], 1, 1, 1, 1),
    area: 'P3;length size-1',
    why: 'Ít hơn size một phần tử vẫn chỉ có một trang.',
  },
  {
    id: 'PAGE-15',
    inputIds: ['A', 'B'],
    query: pageQuery(),
    expected: pageExpected(['A', 'B'], 2, 1, 1, 2),
    area: 'P3;length size',
    why: 'Đúng size không được tạo thừa trang thứ hai.',
  },
  {
    id: 'PAGE-16',
    inputIds: ['A', 'B', 'C'],
    query: pageQuery(),
    expected: pageExpected(['A', 'B'], 3, 1, 2, 3),
    area: 'P3;length size+1',
    why: 'Thêm một phần tử phải tăng số trang; bắt Math.floor thay Math.ceil.',
  },
  {
    id: 'PAGE-17',
    inputIds: ['A', 'B', 'C', 'D', 'E'],
    query: pageQuery({ size: 1, page: 5 }),
    expected: pageExpected(['E'], 5, 5, 5, 5, 1),
    area: 'P3;size min',
    why: 'Kích thước nhỏ nhất, trang cuối vẫn tính chính xác.',
  },
  {
    id: 'PAGE-18',
    inputIds: ['A', 'B', 'C', 'D', 'E'],
    query: pageQuery({ size: 50 }),
    expected: pageExpected(['A', 'B', 'C', 'D', 'E'], 5, 1, 1, 5, 50),
    area: 'P3;size max',
    why: 'Size lớn hơn catalog không được thêm phần tử rỗng.',
  },
  {
    id: 'PAGE-19',
    inputIds: ['A', 'B', 'C', 'D', 'E'],
    query: pageQuery({ page: 9007199254740991 }),
    expected: pageExpected(['E'], 5, 3, 3),
    area: 'P4',
    why: 'Trang rất lớn được clamp trước khi nhân chỉ số slice.',
  },
  {
    id: 'PAGE-20',
    inputIds: ['A', 'B', 'C', 'D', 'E'],
    query: pageQuery({ status: 'ARCHIVED' }),
    expected: pageExpected(['D'], 1, 1, 1),
    area: 'P2',
    why: 'Kiểm trạng thái lưu trữ khớp chính xác, không bị coi là mất dữ liệu.',
  },
];

export const durationCases = [
  {
    id: 'DUR-01',
    input: null,
    expected: 'Chưa có dữ liệu',
    area: 'D1',
    why: 'Thiếu metadata phải khác thời lượng bằng 0.',
  },
  {
    id: 'DUR-02',
    input: 0,
    expected: '0 phút',
    area: 'D2;min',
    why: 'Zero là số để định dạng, không được dùng !seconds rồi coi là null.',
  },
  {
    id: 'DUR-03',
    input: 1,
    expected: '0 phút 1 giây',
    area: 'D3;min+1',
    why: 'Giây nhỏ nhất phải được giữ, chưa đủ phút.',
  },
  {
    id: 'DUR-04',
    input: 59,
    expected: '0 phút 59 giây',
    area: 'D3;60-1',
    why: 'Không làm tròn 59 giây lên 1 phút.',
  },
  {
    id: 'DUR-05',
    input: 60,
    expected: '1 phút',
    area: 'D2;60',
    why: 'Đúng một phút không thêm 0 giây.',
  },
  {
    id: 'DUR-06',
    input: 61,
    expected: '1 phút 1 giây',
    area: 'D3;60+1',
    why: 'Giây dư sau một phút không được mất.',
  },
  {
    id: 'DUR-07',
    input: 119,
    expected: '1 phút 59 giây',
    area: 'D3;120-1',
    why: 'Kiểm lại chu kỳ phút kế tiếp, tránh chỉ đúng ở phút đầu.',
  },
  {
    id: 'DUR-08',
    input: 120,
    expected: '2 phút',
    area: 'D2;120',
    why: 'Bội 60 tiếp theo cũng không hiển thị 0 giây.',
  },
  {
    id: 'DUR-09',
    input: 1800,
    expected: '30 phút',
    area: 'D2',
    why: 'Ví dụ Mini trong tài liệu: quy đổi 1800 giây bằng 30 phút.',
  },
  {
    id: 'DUR-10',
    input: 7200,
    expected: '120 phút',
    area: 'D2',
    why: 'Ví dụ Full: 7200 giây bằng 120 phút; hàm không đổi sang giờ.',
  },
];

for (const c of urlCases) {
  test(`${c.id} readTestParams: ${c.why}`, (t) => {
    const input = new URLSearchParams(c.raw);
    const before = input.toString();
    const actual = readTestParams(input);
    t.diagnostic(
      `OBSERVATION ${JSON.stringify({ id: c.id, input: c.raw, expected: c.expected, actual })}`,
    );
    assert.deepEqual(actual, c.expected);
    assert.equal(input.toString(), before, 'URL input must not be mutated');
  });
}

for (const c of pageCases) {
  test(`${c.id} selectTestPage: ${c.why}`, (t) => {
    const input = Object.freeze(
      c.inputIds.map((id) => {
        const item = catalog.find((row) => row.id === id);
        assert.ok(item, `Unknown fixture ID ${id}`);
        return item;
      }),
    );
    const query = Object.freeze({ ...c.query });
    const before = JSON.stringify({ input, query });
    // Expected order/membership/totals are authored above, not calculated by filtering/paging.
    const expected = {
      items: c.expected.ids.map((id) => catalog.find((row) => row.id === id)!),
      total: c.expected.total,
      catalogTotal: c.expected.catalogTotal,
      page: c.expected.page,
      size: c.expected.size,
      totalPages: c.expected.totalPages,
    };
    const actual = selectTestPage(input, query);
    t.diagnostic(
      `OBSERVATION ${JSON.stringify({ id: c.id, input: { catalog: c.inputIds, query }, expected, actual })}`,
    );
    assert.deepEqual(actual, expected);
    assert.equal(JSON.stringify({ input, query }), before, 'Catalog and query must not be mutated');
    assert.notEqual(actual.items, input, 'Result array must be a new array');
  });
}

for (const c of durationCases) {
  test(`${c.id} formatTestDuration: ${c.why}`, (t) => {
    const actual = formatTestDuration(c.input);
    t.diagnostic(
      `OBSERVATION ${JSON.stringify({ id: c.id, input: c.input, expected: c.expected, actual })}`,
    );
    assert.equal(actual, c.expected);
  });
}
