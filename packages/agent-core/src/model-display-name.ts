const MODEL_DISPLAY_NAME_SEPARATOR_PATTERN = /[-:/]/g;
const PURE_DIGIT_TOKEN_PATTERN = /^\d+$/;

/** 相邻纯数字段视为主次版本号，合并为 `major.minor`（如 `4-8` → `4.8`）。 */
function mergeConsecutiveNumericVersionSegments(tokens: string[]): string[] {
  const merged: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const current = tokens[index];
    const next = tokens[index + 1];
    if (
      current
      && next
      && PURE_DIGIT_TOKEN_PATTERN.test(current)
      && PURE_DIGIT_TOKEN_PATTERN.test(next)
    ) {
      merged.push(`${current}.${next}`);
      index += 1;
      continue;
    }
    if (!current) {
      continue;
    }
    merged.push(current);
  }
  return merged;
}

/** 将模型 id 格式化为展示名：`-`/`:`/` → 空格，相邻数字段合并为点分版本，各词首字母大写。 */
export function formatModelDisplayNameFromId(modelId: string): string {
  const normalized = modelId
    .trim()
    .replace(MODEL_DISPLAY_NAME_SEPARATOR_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    return modelId;
  }

  const tokens = normalized.split(' ').filter((token) => token.length > 0);
  const versionAwareTokens = mergeConsecutiveNumericVersionSegments(tokens);

  return versionAwareTokens
    .map((word) => {
      if (!word) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
