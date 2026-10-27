export type ProfilePreview = 'ready' | 'loading' | 'error' | 'empty' | 'save-error';

export interface DemoProfile {
  source: 'profile-demo';
  fullName: string;
  phoneNumber: string | null;
  email: string;
  role: 'USER';
  status: 'ACTIVE';
  joinedAt: string;
}

export interface ProfileDraft {
  fullName: string;
  phoneNumber: string;
}

// Only these fields may be submitted. Avatar preview is never an upload or profile update.
export interface ProfileChanges {
  fullName: string;
  phoneNumber: string | null;
}

export type ProfileErrors = Partial<Record<keyof ProfileDraft, string>>;

export interface ProfileRepository {
  load: (signal: AbortSignal) => Promise<DemoProfile | null>;
  save: (changes: ProfileChanges, signal: AbortSignal) => Promise<DemoProfile>;
}
