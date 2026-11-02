import { CMS_DESTINATIONS } from './cms-fixtures';

// Implemented content details and question edit children belong to the content preview.
// This resolves demo navigation, never backend authorization.
export function resolveCmsDestination(
  pathname: string,
): (typeof CMS_DESTINATIONS)[number] | undefined {
  const child =
    /^\/(questions|tests|lessons|vocabulary|users|media|groups|topics)(?:\/[^/]+(?:\/edit)?)?$/.exec(
      pathname,
    );
  const section = child?.[1];
  const parent =
    section === 'groups'
      ? '/questions'
      : section === 'topics'
        ? '/vocabulary'
        : section
          ? `/${section}`
          : pathname;
  return CMS_DESTINATIONS.find((item) => item.href === parent);
}
