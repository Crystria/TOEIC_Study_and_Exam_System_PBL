'use client';

import { useState } from 'react';
import { profileInitials } from '../../lib/profile/fixture';

export function AccountAvatar({
  source,
  name,
  label,
  large = false,
}: {
  source?: string | null;
  name?: string;
  label?: string;
  large?: boolean;
}) {
  const [failedSource, setFailedSource] = useState<string>();
  return (
    <span
      className={large ? 'avatar avatar--profile' : 'avatar'}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {source && source !== failedSource ? (
        // Load the signed storage URL or local preview directly.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={source}
          className="avatar-image"
          src={source}
          alt=""
          onError={() => setFailedSource(source)}
        />
      ) : name ? (
        profileInitials(name)
      ) : (
        'HV'
      )}
    </span>
  );
}
