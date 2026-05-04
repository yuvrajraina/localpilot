const REDACTION = '[REDACTED_SECRET]';

const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bASIA[0-9A-Z]{16}\b/g,
  /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[^"'\s]{16,}["']?/gi,
  /\beyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g,
  /\b[A-Za-z0-9_-]{48,}\b/g
];

export type SecretRedactionResult = {
  text: string;
  redacted: boolean;
};

export function redactSecrets(text: string): SecretRedactionResult {
  let redactedText = text;

  for (const pattern of SECRET_PATTERNS) {
    redactedText = redactedText.replace(pattern, REDACTION);
  }

  return {
    text: redactedText,
    redacted: redactedText !== text
  };
}

export function containsSecret(text: string): boolean {
  return redactSecrets(text).redacted;
}
