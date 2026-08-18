export function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? (fallback ? process.env[fallback] : undefined);
  if (!value || !value.trim()) {
    throw new Error(`Missing environment variable ${name}${fallback ? ` or ${fallback}` : ""}`);
  }
  return value;
}
