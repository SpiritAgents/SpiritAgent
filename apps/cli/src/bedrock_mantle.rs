//! Bedrock Mantle OpenAI frontier helpers（与 `host-internal/bedrock-mantle` 对齐）。

/// Bedrock Mantle OpenAI 模型 ID，如 `openai.gpt-5.5`、`openai.gpt-oss-120b`。
pub fn is_bedrock_mantle_openai_model(model_id: &str) -> bool {
    let trimmed = model_id.trim();
    trimmed.len() > "openai.gpt-".len()
        && trimmed[.."openai.gpt-".len()].eq_ignore_ascii_case("openai.gpt-")
}

pub fn normalize_aws_region(region: &str) -> Option<String> {
    let normalized = region.trim().to_lowercase();
    if normalized.is_empty() {
        return None;
    }
    Some(normalized)
}

pub fn bedrock_mantle_api_base_from_region(region: &str) -> String {
    match normalize_aws_region(region) {
        Some(normalized) => format!("https://bedrock-mantle.{normalized}.api.aws/openai/v1"),
        None => "https://bedrock-mantle.us-east-1.api.aws/openai/v1".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_bedrock_mantle_openai_model_matches_frontier_and_oss_ids() {
        assert!(is_bedrock_mantle_openai_model("openai.gpt-5.5"));
        assert!(is_bedrock_mantle_openai_model("openai.gpt-oss-120b"));
        assert!(!is_bedrock_mantle_openai_model("anthropic.claude-3-5-sonnet-20241022-v2:0"));
    }

    #[test]
    fn bedrock_mantle_api_base_from_region_uses_openai_v1_path() {
        assert_eq!(
            bedrock_mantle_api_base_from_region("us-east-2"),
            "https://bedrock-mantle.us-east-2.api.aws/openai/v1"
        );
    }
}
