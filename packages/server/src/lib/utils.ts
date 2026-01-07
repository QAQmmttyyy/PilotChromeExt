export function generateId(): string {
  return crypto.randomUUID();
}

export function cleanGeneratedCode(code: string): string {
  let cleaned = code;

  cleaned = cleaned.replace(/^```(?:javascript|js)?\s*\n?/i, '');
  cleaned = cleaned.replace(/\n?```\s*$/i, '');

  const anchors = [
    '// === STEP:',
    '(async () =>',
    ';(async () =>',
    '(() =>',
    ';(() =>',
    'const ',
    'let ',
    'var ',
    'function ',
  ];

  let idx = -1;
  for (const a of anchors) {
    const i = cleaned.indexOf(a);
    if (i >= 0 && (idx === -1 || i < idx)) idx = i;
  }
  if (idx > 0) cleaned = cleaned.slice(idx);

  return cleaned.trim();
}

