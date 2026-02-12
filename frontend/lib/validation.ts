/**
 * Validate password strength.
 * Requires min 8 chars, at least 1 letter, and at least 1 number or special character.
 */
export function validatePassword(password: string): { isValid: boolean; error: string | null } {
  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters' };
  }

  if (!/[a-zA-Z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one letter' };
  }

  if (!/[\d!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one number or special character' };
  }

  return { isValid: true, error: null };
}

const TITLES = ['mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'rev', 'sir', 'dame', 'lord', 'lady'];

/**
 * Strip common titles (Mr, Mrs, Dr, etc.) from the start of a name.
 */
function stripTitle(name: string): string {
  const lower = name.trim().toLowerCase();
  for (const title of TITLES) {
    for (const suffix of ['. ', ' ']) {
      const prefix = title + suffix;
      if (lower.startsWith(prefix)) {
        return lower.substring(prefix.length).trim();
      }
    }
    // Handle title with dot but no trailing space (end of string)
    if (lower === title || lower === title + '.') {
      return '';
    }
  }
  return lower;
}

/**
 * Validate that a typed signature matches an expected full name,
 * ignoring common titles (Mr, Mrs, Dr, etc.) on the signature.
 *
 * Returns true if the names match, or if expectedName is empty/missing.
 */
export function validateSignatureAgainstName(signature: string, expectedName: string): boolean {
  if (!expectedName?.trim()) return true;

  const normalizedExpected = expectedName.trim().toLowerCase();
  const normalizedSignature = stripTitle(signature);

  return normalizedSignature === normalizedExpected;
}
