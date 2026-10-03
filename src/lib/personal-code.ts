import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

const CODE_LENGTH = 6;

export function generatePersonalCode() {
  return randomInt(0, 1_000_000).toString().padStart(CODE_LENGTH, "0");
}

// A new member's first code is the last six digits of their own phone, so
// nobody has to deliver it to them. It is a shared secret with anyone who
// knows the number, which is why signing in with it forces a change.
export function initialCodeFromPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-CODE_LENGTH).padStart(CODE_LENGTH, "0");
}

export function hashPersonalCode(code: string) {
  return bcrypt.hash(code, 12);
}

export function verifyPersonalCode(code: string, codeHash: string) {
  return bcrypt.compare(code, codeHash);
}
