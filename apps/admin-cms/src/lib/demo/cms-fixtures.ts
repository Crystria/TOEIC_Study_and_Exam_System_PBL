// UI fixtures only; never an authenticated account or API permission.
export type DemoRole = 'SYSTEM_ADMIN' | 'CONTENT_ADMIN';
export type CmsPath =
  '/questions' | '/tests' | '/lessons' | '/vocabulary' | '/media' | '/users' | '/audit-logs';

interface DemoPersona {
  label: string;
  name: string;
  initials: string;
  description: string;
  home: CmsPath;
}

export const DEMO_PERSONAS: Record<DemoRole, DemoPersona> = {
  CONTENT_ADMIN: {
    label: 'Quản trị nội dung',
    name: 'Minh Anh · Nhân vật demo',
    initials: 'MA',
    description: 'Khám phá không gian câu hỏi, đề thi, bài học và từ vựng.',
    home: '/questions',
  },
  SYSTEM_ADMIN: {
    label: 'Quản trị hệ thống',
    name: 'Hoàng Nam · Nhân vật demo',
    initials: 'HN',
    description: 'Khám phá không gian người dùng và nhật ký quản trị.',
    home: '/users',
  },
};

interface CmsDestination {
  href: CmsPath;
  label: string;
  shortLabel: string;
  group: 'Nội dung học tập' | 'Quản trị hệ thống';
  role: DemoRole;
  description: string;
}

// SRS user classes and FK-03/05/07/10/11: no implicit role inheritance specified.
export const CMS_DESTINATIONS: readonly CmsDestination[] = [
  {
    href: '/media',
    label: 'Media quản trị',
    shortLabel: 'MD',
    group: 'Nội dung học tập',
    role: 'CONTENT_ADMIN',
    description: 'Chọn và xem trước audio/hình ảnh cục bộ trong RAM demo.',
  },
  {
    href: '/questions',
    label: 'Ngân hàng câu hỏi',
    shortLabel: 'CH',
    group: 'Nội dung học tập',
    role: 'CONTENT_ADMIN',
    description: 'Câu hỏi Listening Part 1–4 và Reading Part 5–7.',
  },
  {
    href: '/tests',
    label: 'Đề thi',
    shortLabel: 'ĐT',
    group: 'Nội dung học tập',
    role: 'CONTENT_ADMIN',
    description: 'Cấu trúc đề thi thử Full Test và Mini Test.',
  },
  {
    href: '/lessons',
    label: 'Bài học ngữ pháp',
    shortLabel: 'NP',
    group: 'Nội dung học tập',
    role: 'CONTENT_ADMIN',
    description: 'Thư viện bài giảng lý thuyết ngữ pháp TOEIC.',
  },
  {
    href: '/vocabulary',
    label: 'Từ vựng',
    shortLabel: 'TV',
    group: 'Nội dung học tập',
    role: 'CONTENT_ADMIN',
    description: 'Chủ đề và nội dung từ vựng, Flashcard.',
  },
  {
    href: '/users',
    label: 'Người dùng & vai trò',
    shortLabel: 'ND',
    group: 'Quản trị hệ thống',
    role: 'SYSTEM_ADMIN',
    description: 'Không gian quản lý tài khoản, vai trò và trạng thái.',
  },
  {
    href: '/audit-logs',
    label: 'Nhật ký quản trị',
    shortLabel: 'NK',
    group: 'Quản trị hệ thống',
    role: 'SYSTEM_ADMIN',
    description: 'Không gian xem nhật ký thao tác quản trị.',
  },
];

export function demoHref(path: CmsPath, role: DemoRole): string {
  return `${path}?demoRole=${role}`;
}

export function parseDemoRole(value: string | null): DemoRole {
  return value === 'SYSTEM_ADMIN' ? 'SYSTEM_ADMIN' : 'CONTENT_ADMIN';
}
