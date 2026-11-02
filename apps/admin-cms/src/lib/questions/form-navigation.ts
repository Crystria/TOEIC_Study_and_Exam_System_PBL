import { readDetailParams } from './detail-navigation';

// Reuse the list allowlist; discard detail tools and arbitrary returnTo paths.
export function questionFormNavigation(params: URLSearchParams) {
  const backHref = readDetailParams(params).backHref;
  return { backHref, search: backHref.split('?')[1] };
}

export function questionFormHref(params: URLSearchParams, id?: string): string {
  const path = id === undefined ? '/questions/new' : `/questions/${encodeURIComponent(id)}/edit`;
  return `${path}?${questionFormNavigation(params).search}`;
}
