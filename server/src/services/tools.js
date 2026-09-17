export function generateSecurityAdvice(prompt) {
  const normalized = String(prompt).toLowerCase();
  if (normalized.includes('credential') || normalized.includes('bypass') || normalized.includes('phish') || normalized.includes('malware')) {
    return 'NexusAI safety guardrail: this request falls outside authorized, defensive usage. This app only supports secure coding guidance, password-strength education, log analysis, remediation guidance, and CTF/lab exercises in controlled environments.';
  }

  return `Defensive security review:\n\n1. Validate inputs and reject untrusted data early.\n2. Use least-privilege permissions and read-only access for sensitive systems.\n3. Keep secrets in environment variables or a secrets manager, never in source code.\n4. Enable logging, alerting, and anomaly detection for suspicious activity.\n5. Regularly update dependencies and review security advisories.\n6. Practice on isolated lab targets such as intentionally vulnerable local containers.\n7. Verify code changes with security code reviews and automated checks.\n\nThis guidance is limited to safe, authorized defensive security and secure coding practices.`;
}
