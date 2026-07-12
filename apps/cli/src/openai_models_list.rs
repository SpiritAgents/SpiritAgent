//! OpenAI-compatible `GET /v1/models` listing — aligned with `packages/host-internal/src/openai-models.ts`.

use crate::model_registry::ModelTransportKind;
use serde_json::Value;

const MODELS_PATH: &str = "/models";
const ANTHROPIC_VERSION: &str = "2023-06-01";

pub fn normalize_openai_api_base(base_url: &str) -> String {
    base_url.trim().trim_end_matches('/').to_string()
}

pub fn openai_compatible_models_list_url(base_url: &str) -> String {
    format!("{}{}", normalize_openai_api_base(base_url), MODELS_PATH)
}

pub fn anthropic_models_list_url(base_url: &str) -> String {
    format!("{}{}", normalize_openai_api_base(base_url), MODELS_PATH)
}

/// Parse `data[].id` from an OpenAI-style list models JSON body.
pub fn parse_openai_models_payload(json: &Value) -> Vec<String> {
    let Some(data) = json.get("data").and_then(|v| v.as_array()) else {
        return Vec::new();
    };
    let mut ids = Vec::new();
    for entry in data {
        let Some(id) = entry.get("id").and_then(|v| v.as_str()) else {
            continue;
        };
        let t = id.trim();
        if !t.is_empty() {
            ids.push(t.to_string());
        }
    }
    ids.sort();
    ids.dedup();
    ids
}

pub fn parse_anthropic_models_payload(json: &Value) -> Vec<String> {
    let Some(data) = json.get("data").and_then(|v| v.as_array()) else {
        return Vec::new();
    };
    let mut ids = Vec::new();
    for entry in data {
        let Some(id) = entry.get("id").and_then(|v| v.as_str()) else {
            continue;
        };
        let t = id.trim();
        if !t.is_empty() {
            ids.push(t.to_string());
        }
    }
    ids.sort();
    ids.dedup();
    ids
}

/// `GET {apiBase}/models` with Bearer auth; returns sorted unique ids.
pub fn list_openai_compatible_model_ids(
    api_base: &str,
    api_key: &str,
) -> Result<Vec<String>, String> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err("API Key 不能为空。".to_string());
    }

    let url = openai_compatible_models_list_url(api_base);
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("HTTP 客户端初始化失败：{e}"))?;

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {key}"))
        .send()
        .map_err(|e| format!("列模型请求失败：{e}"))?;

    let status = response.status();
    let text = response
        .text()
        .map_err(|e| format!("列模型响应读取失败：{e}"))?;

    let json: Value = if text.trim().is_empty() {
        Value::Object(Default::default())
    } else {
        serde_json::from_str(&text).map_err(|_| {
            if status.is_success() {
                "列模型响应不是合法 JSON。".to_string()
            } else {
                format!("列模型失败（HTTP {}）。", status.as_u16())
            }
        })?
    };

    if !status.is_success() {
        let err_msg = json
            .get("error")
            .and_then(|e| e.get("message"))
            .and_then(|m| m.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty());
        return Err(match err_msg {
            Some(m) => format!("列模型失败（HTTP {}）：{}", status.as_u16(), m),
            None => format!("列模型失败（HTTP {}）。", status.as_u16()),
        });
    }

    Ok(parse_openai_models_payload(&json))
}

pub fn list_anthropic_model_ids(api_base: &str, api_key: &str) -> Result<Vec<String>, String> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err("API Key 不能为空。".to_string());
    }

    let url = anthropic_models_list_url(api_base);
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("HTTP 客户端初始化失败：{e}"))?;

    let response = client
        .get(&url)
        .header("x-api-key", key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .send()
        .map_err(|e| format!("列模型请求失败：{e}"))?;

    let status = response.status();
    let text = response
        .text()
        .map_err(|e| format!("列模型响应读取失败：{e}"))?;

    let json: Value = if text.trim().is_empty() {
        Value::Object(Default::default())
    } else {
        serde_json::from_str(&text).map_err(|_| {
            if status.is_success() {
                "列模型响应不是合法 JSON。".to_string()
            } else {
                format!("列模型失败（HTTP {}）。", status.as_u16())
            }
        })?
    };

    if !status.is_success() {
        let err_msg = json.get("error").and_then(|error| {
            error
                .get("message")
                .and_then(Value::as_str)
                .or_else(|| error.as_str())
        }).map(str::trim).filter(|s| !s.is_empty());
        return Err(match err_msg {
            Some(m) => format!("列模型失败（HTTP {}）：{}", status.as_u16(), m),
            None => format!("列模型失败（HTTP {}）。", status.as_u16()),
        });
    }

    Ok(parse_anthropic_models_payload(&json))
}

fn unwrap_cloudflare_models_search_payload(json: &Value) -> &Value {
    if json.get("data").and_then(|v| v.as_array()).is_some() {
        return json;
    }
    json.get("result").unwrap_or(json)
}

/// Parse OpenRouter-format `data[].id` from Cloudflare models/search responses.
pub fn parse_openrouter_format_model_ids(json: &Value) -> Vec<String> {
    let body = unwrap_cloudflare_models_search_payload(json);
    let Some(data) = body.get("data").and_then(|v| v.as_array()) else {
        return Vec::new();
    };
    let mut ids = Vec::new();
    for entry in data {
        let Some(id) = entry.get("id").and_then(|v| v.as_str()) else {
            continue;
        };
        let trimmed = id.trim();
        if !trimmed.is_empty() {
            ids.push(trimmed.to_string());
        }
    }
    ids.sort();
    ids.dedup();
    ids
}

pub fn list_cloudflare_ai_gateway_model_ids(
    account_id: &str,
    api_key: &str,
) -> Result<Vec<String>, String> {
    let account = account_id.trim();
    if account.len() != 32 || !account.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("Cloudflare Account ID 须为 32 位十六进制字符串。".to_string());
    }
    let key = api_key.trim();
    if key.is_empty() {
        return Err("API Token 不能为空。".to_string());
    }

    let url = format!(
        "https://api.cloudflare.com/client/v4/accounts/{account}/ai/models/search?format=openrouter"
    );
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("HTTP 客户端初始化失败：{e}"))?;

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {key}"))
        .send()
        .map_err(|e| format!("列模型请求失败：{e}"))?;

    let status = response.status();
    let text = response
        .text()
        .map_err(|e| format!("列模型响应读取失败：{e}"))?;

    let json: Value = if text.trim().is_empty() {
        Value::Object(Default::default())
    } else {
        serde_json::from_str(&text).map_err(|_| {
            if status.is_success() {
                "列模型响应不是合法 JSON。".to_string()
            } else {
                format!("列模型失败（HTTP {}）。", status.as_u16())
            }
        })?
    };

    if !status.is_success() {
        let err_msg = json
            .get("errors")
            .and_then(|errors| errors.as_array())
            .and_then(|errors| errors.first())
            .and_then(|error| error.get("message"))
            .and_then(|message| message.as_str())
            .or_else(|| {
                json.get("error")
                    .and_then(|error| error.get("message"))
                    .and_then(|message| message.as_str())
            })
            .map(str::trim)
            .filter(|message| !message.is_empty());
        return Err(match err_msg {
            Some(message) => format!("列模型失败（HTTP {}）：{}", status.as_u16(), message),
            None => format!("列模型失败（HTTP {}）。", status.as_u16()),
        });
    }

    Ok(parse_openrouter_format_model_ids(&json))
}

pub fn list_model_ids(
    api_base: &str,
    api_key: &str,
    transport_kind: ModelTransportKind,
) -> Result<Vec<String>, String> {
    match transport_kind {
        ModelTransportKind::OpenAiCompatible | ModelTransportKind::OpenResponses => {
            list_openai_compatible_model_ids(api_base, api_key)
        }
        ModelTransportKind::Anthropic => list_anthropic_model_ids(api_base, api_key),
        ModelTransportKind::Bedrock => Err(
            "Amazon Bedrock 模型列表请使用 Desktop 连接向导导入，或读取 Desktop 写入的 catalog cache"
                .to_string(),
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parse_openai_models_payload_reads_data_ids() {
        let body = json!({
            "data": [
                { "id": "z" },
                { "id": "a" },
                { "id": "a" },
                { "foo": "bar" }
            ]
        });
        assert_eq!(
            parse_openai_models_payload(&body),
            vec!["a".to_string(), "z".to_string()]
        );
    }

    #[test]
    fn parse_anthropic_models_payload_reads_data_ids() {
        let body = json!({
            "data": [
                { "id": "claude-z" },
                { "id": "claude-a" },
                { "id": "claude-a" },
                { "foo": "bar" }
            ]
        });
        assert_eq!(
            parse_anthropic_models_payload(&body),
            vec!["claude-a".to_string(), "claude-z".to_string()]
        );
    }

    #[test]
    fn parse_openrouter_format_model_ids_reads_data_ids() {
        let body = json!({
            "data": [
                { "id": "openai/gpt-4.1" },
                { "id": "anthropic/claude-sonnet-4-5" },
                { "id": "openai/gpt-4.1" }
            ]
        });
        assert_eq!(
            parse_openrouter_format_model_ids(&body),
            vec![
                "anthropic/claude-sonnet-4-5".to_string(),
                "openai/gpt-4.1".to_string(),
            ]
        );
    }

    #[test]
    fn parse_openrouter_format_model_ids_reads_result_wrapper() {
        let body = json!({
            "success": true,
            "result": {
                "data": [{ "id": "openai/gpt-4.1" }]
            }
        });
        assert_eq!(
            parse_openrouter_format_model_ids(&body),
            vec!["openai/gpt-4.1".to_string()]
        );
    }

    #[test]
    fn normalize_openai_api_base_trims_slashes() {
        assert_eq!(normalize_openai_api_base(" https://x/v1/ "), "https://x/v1");
    }
}
