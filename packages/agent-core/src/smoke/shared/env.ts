export function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? (fallback ? process.env[fallback] : undefined);
  if (!value || !value.trim()) {
    throw new Error(`缺少环境变量 ${name}${fallback ? ` 或 ${fallback}` : ''}`);
  }
  return value;
}

export function createAiSdkOpenAiSmokeConfig(): {
  apiKey: string;
  model: string;
  baseUrl?: string;
} {
  const apiKey = requireEnv('OPENAI_API_KEY', 'SPIRIT_API_KEY');
  const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
  const baseUrl = process.env.OPENAI_BASE_URL ?? process.env.SPIRIT_API_BASE;

  return {
    apiKey,
    model,
    ...(baseUrl ? { baseUrl } : {}),
  };
}