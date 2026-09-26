export function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits;
}

export function phoneLookupValues(phone: string) {
  const normalized = normalizePhone(phone);
  return /^\+1\d{10}$/.test(normalized)
    ? [normalized, normalized.slice(1), normalized.slice(2)]
    : [normalized];
}
