import type { DemoProfile, ProfileDraft } from './types';

// Independent fixture; never used as the signed-in user or imported from Dashboard.
export function createDemoProfile(): DemoProfile {
  return {
    source: 'profile-demo',
    fullName: 'Nguyễn Minh An',
    phoneNumber: null,
    email: 'hocvien@example.test',
    role: 'USER',
    status: 'ACTIVE',
    joinedAt: '2026-10-01T02:00:00.000Z',
  };
}

export function profileDraft(profile: DemoProfile): ProfileDraft {
  return { fullName: profile.fullName, phoneNumber: profile.phoneNumber ?? '' };
}

export function profileInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => Array.from(part)[0] ?? '')
    .join('')
    .toLocaleUpperCase('vi');
}
