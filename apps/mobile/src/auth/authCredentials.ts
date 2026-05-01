type AuthCredentials = { email: string } | { phone: string };

export function getAuthCredentials(identifier: string): { attemptKey: string; credentials: AuthCredentials } {
  const normalizedIdentifier = identifier.trim();
  const normalizedEmail = normalizedIdentifier.toLowerCase();
  const phoneDigits = normalizedIdentifier.replace(/\D/g, '');

  if (normalizedIdentifier.includes('@')) {
    return {
      attemptKey: normalizedEmail,
      credentials: { email: normalizedEmail },
    };
  }

  if (phoneDigits.length < 8) {
    throw new Error('Informe um e-mail ou telefone valido.');
  }

  const phone = normalizedIdentifier.startsWith('+')
    ? `+${phoneDigits}`
    : phoneDigits.length === 10 || phoneDigits.length === 11
      ? `+55${phoneDigits}`
      : `+${phoneDigits}`;

  return {
    attemptKey: phone,
    credentials: { phone },
  };
}
