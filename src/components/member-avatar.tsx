type Props = {
  name: string;
  photoUrl?: string;
  size?: number;
  className?: string;
};

export function MemberAvatar({
  name,
  photoUrl,
  size = 40,
  className = "",
}: Props) {
  const trimmedName = name.trim();
  const fallback =
    trimmedName.length <= 2
      ? trimmedName.toUpperCase()
      : trimmedName
          .split(/\s+/)
          .map((part) => part.charAt(0))
          .join("")
          .slice(0, 2)
          .toUpperCase();

  return (
    <span
      className={`member-avatar ${photoUrl ? "member-avatar-photo" : ""} ${className}`.trim()}
      role={photoUrl ? "img" : undefined}
      aria-label={photoUrl ? name : undefined}
      aria-hidden={photoUrl ? undefined : "true"}
      style={{
        width: size,
        height: size,
        ...(photoUrl ? { backgroundImage: `url("${photoUrl}")` } : {}),
      }}
    >
      {!photoUrl && fallback}
    </span>
  );
}
