import type { ProfileChanges, ProfileDraft, ProfileErrors } from './types';

// CSDL 3.2.1 / 5.2.1: VARCHAR(255), nullable VARCHAR(32).
export const PROFILE_NAME_LIMIT = 255;
export const PROFILE_PHONE_LIMIT = 32;
// Storage section 7 proposes 2 MB for avatars; demo uses decimal MB.
export const AVATAR_PREVIEW_MAX_BYTES = 2_000_000;
export const profileCharacterCount = (value: string) => Array.from(value).length;

export function validateProfile(draft: ProfileDraft): ProfileErrors {
  const errors: ProfileErrors = {};
  if (!draft.fullName.trim()) errors.fullName = 'Vui lòng nhập họ tên.';
  else if (profileCharacterCount(draft.fullName) > PROFILE_NAME_LIMIT)
    errors.fullName = 'Họ tên chỉ được tối đa 255 ký tự.';
  if (profileCharacterCount(draft.phoneNumber) > PROFILE_PHONE_LIMIT)
    errors.phoneNumber = 'Số điện thoại chỉ được tối đa 32 ký tự.';
  // SRS only specifies strings for profile updates; do not invent phone formats
  // or transfer the registration-only minimum name length to editing a profile.
  return errors;
}

export function profileChanges(draft: ProfileDraft): ProfileChanges {
  return {
    fullName: draft.fullName,
    phoneNumber: draft.phoneNumber.trim() ? draft.phoneNumber : null,
  };
}

export function validateAvatarFile(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  const extension = /\.([^.]+)$/.exec(file.name)?.[1].toLowerCase();
  const mimeByExtension: Record<string, string> = {
    jpg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };
  if (
    !extension ||
    !Object.hasOwn(mimeByExtension, extension) ||
    mimeByExtension[extension] !== file.type
  )
    return 'Chọn ảnh JPG, PNG hoặc WebP có định dạng tệp phù hợp.';
  if (!Number.isSafeInteger(file.size) || file.size <= 0)
    return 'Tệp ảnh trống hoặc không hợp lệ. Vui lòng chọn ảnh khác.';
  if (file.size > AVATAR_PREVIEW_MAX_BYTES) return 'Ảnh xem trước chỉ được tối đa 2 MB.';
  return null;
}
