import { createDemoProfile } from './fixture';
import type { ProfilePreview, ProfileRepository } from './types';
import { validateProfile } from './validation';

function pause(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', abort, { once: true });
  });
}

// A new instance belongs to one mounted profile page. No storage, API or identity mutation.
export function createProfileRepository(preview: ProfilePreview): ProfileRepository {
  let profile = createDemoProfile();
  let failLoad = preview === 'error';
  let failSave = preview === 'save-error';
  return {
    async load(signal) {
      await pause(preview === 'loading' ? 1800 : 250, signal);
      if (failLoad) {
        failLoad = false;
        throw new Error('Demo profile load failed');
      }
      return preview === 'empty' ? null : { ...profile };
    },
    async save(changes, signal) {
      if (Object.keys(changes).some((key) => key !== 'fullName' && key !== 'phoneNumber'))
        throw new Error('Unexpected profile field');
      if (
        typeof changes.fullName !== 'string' ||
        (changes.phoneNumber !== null && typeof changes.phoneNumber !== 'string')
      )
        throw new Error('Invalid profile changes');
      const errors = validateProfile({
        fullName: changes.fullName,
        phoneNumber: changes.phoneNumber ?? '',
      });
      if (Object.keys(errors).length) throw new Error('Invalid profile changes');
      await pause(700, signal);
      if (failSave) {
        failSave = false;
        throw new Error('Demo profile save failed');
      }
      profile = { ...profile, fullName: changes.fullName, phoneNumber: changes.phoneNumber };
      return { ...profile };
    },
  };
}
