import { useEffect, useState } from 'react';

/** @param {unknown} value */
export function hasUsableAvatar(value) {
  if (typeof value !== 'string') return false;
  const src = value.trim();
  if (!src) return false;
  return src.startsWith('data:image/') || /^https?:\/\//i.test(src);
}

/** @param {{ name?: string, email?: string } | null | undefined} user */
export function avatarInitial(user) {
  const name = String(user?.name || '').trim();
  if (name) return name.charAt(0).toUpperCase();
  const email = String(user?.email || '').trim();
  if (email) return email.charAt(0).toUpperCase();
  return 'U';
}

/**
 * Initials fallback when avatar is missing or fails to load.
 * @param {{
 *   user?: { name?: string, email?: string, avatar?: string } | null,
 *   className?: string,
 *   imgClassName?: string,
 *   size?: 'sm' | 'lg',
 * }} props
 */
export default function UserAvatar({
  user,
  className = 'settings-avatar',
  imgClassName,
  size,
}) {
  const src = hasUsableAvatar(user?.avatar) ? String(user.avatar).trim() : '';
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const letter = avatarInitial(user);
  const showPhoto = Boolean(src) && !failed;
  const classes = [
    className,
    size === 'lg' ? 'settings-avatar--lg' : '',
    showPhoto && String(className).includes('settings-avatar') ? 'settings-avatar--photo' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} aria-hidden>
      {showPhoto ? (
        <img
          src={src}
          alt=""
          className={imgClassName}
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="user-avatar-letter">{letter}</span>
      )}
    </div>
  );
}
