import { validateEvent as validateRuntimeEvent } from '@toeic/contracts/p0/runtime.cjs';
export function validateEvent(event: unknown): string {
  return validateRuntimeEvent(event);
}
