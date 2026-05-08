export const MIN_PASSWORD_LENGTH = 8;

export function evaluatePasswordRules(password: string) {
  return {
    length: password.length >= MIN_PASSWORD_LENGTH,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

export function passwordMeetsRequirements(password: string) {
  const checks = evaluatePasswordRules(password);

  return Object.values(checks).every(Boolean);
}
