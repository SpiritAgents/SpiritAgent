use anyhow::anyhow;
use serde_json::{Value, json};

use crate::host_runtime::ToolUiRequest;

pub(crate) fn approval_decision_from_input(message: &str) -> Value {
    let decision = message.trim().to_lowercase();
    match decision.as_str() {
        "y" => json!({ "kind": "allow" }),
        "t" => json!({ "kind": "allow", "persistTrust": true }),
        "n" => json!({ "kind": "deny" }),
        _ => json!({
            "kind": "guidance",
            "userMessage": message,
        }),
    }
}

pub(crate) fn extract_path_from_partial_tool_json(arguments_json: &str) -> Option<String> {
    let marker = "\"path\"";
    let start = arguments_json.find(marker)? + marker.len();
    let after = arguments_json.get(start..)?.trim_start();
    let after = after.strip_prefix(':')?.trim_start();
    let after = after.strip_prefix('"')?;
    let mut escaped = String::new();
    let mut chars = after.chars();
    while let Some(ch) = chars.next() {
        if ch == '\\' {
            escaped.push(chars.next()?);
        } else if ch == '"' {
            break;
        } else {
            escaped.push(ch);
        }
    }
    if escaped.is_empty() {
        None
    } else {
        Some(escaped)
    }
}

pub(crate) fn tool_request_from_streaming_preview(tool_name: &str, arguments_json: &str) -> ToolUiRequest {
    match serde_json::from_str::<Value>(arguments_json) {
        Ok(arguments) => ToolUiRequest::new(tool_name, arguments),
        Err(_) => {
            let mut object = serde_json::Map::new();
            if let Some(path) = extract_path_from_partial_tool_json(arguments_json) {
                object.insert("path".to_string(), Value::String(path));
            }
            ToolUiRequest::new(tool_name, Value::Object(object))
        }
    }
}

pub(crate) fn tool_request_from_host_value(value: Value) -> anyhow::Result<ToolUiRequest> {
    let Value::Object(mut object) = value else {
        return Err(anyhow!("工具请求必须是 JSON object"));
    };

    let name = object
        .remove("name")
        .and_then(|value| value.as_str().map(ToOwned::to_owned))
        .ok_or_else(|| anyhow!("工具请求缺少 name"))?;

    Ok(ToolUiRequest::new(name, Value::Object(object)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::host_protocol::BridgeRuntimeEvent;
    use serde_json::json;

    #[test]
    fn bridge_runtime_event_accepts_camel_case_background_status_fields() {
        let value = json!({
            "kind": "background-tool-status",
            "phase": "finished",
            "toolName": "mcp_tool",
            "request": { "server": "github", "tool_name": "get_me" },
            "statusText": "MCP 工具执行中: github / get_me",
            "failed": false,
        });

        let event: BridgeRuntimeEvent =
            serde_json::from_value(value).expect("event should deserialize");
        match event {
            BridgeRuntimeEvent::BackgroundToolStatus {
                phase,
                tool_name,
                request,
                status_text,
                failed,
            } => {
                assert_eq!(phase, "finished");
                assert_eq!(tool_name.as_deref(), Some("mcp_tool"));
                assert!(request.is_some());
                assert_eq!(
                    status_text.as_deref(),
                    Some("MCP 工具执行中: github / get_me")
                );
                assert_eq!(failed, Some(false));
            }
            other => panic!("unexpected event variant: {other:?}"),
        }
    }

    #[test]
    fn bridge_runtime_event_accepts_assistant_thinking_segment_finalized() {
        let value = json!({
            "kind": "assistant-thinking-segment-finalized",
            "text": "先分析一下用户意图",
        });

        let event: BridgeRuntimeEvent =
            serde_json::from_value(value).expect("event should deserialize");
        match event {
            BridgeRuntimeEvent::AssistantThinkingSegmentFinalized { text } => {
                assert_eq!(text, "先分析一下用户意图");
            }
            other => panic!("unexpected event variant: {other:?}"),
        }
    }

    #[test]
    fn tool_request_from_host_value_rejects_legacy_rust_enum_shape() {
        let err = tool_request_from_host_value(json!({
            "WebFetch": {
                "url": "https://example.com"
            }
        }))
        .expect_err("legacy rust enum shape should be rejected");

        assert!(err.to_string().contains("工具请求缺少 name"));
    }

    #[test]
    fn tool_request_from_host_value_keeps_name_and_args_without_rust_semantics() {
        let request = tool_request_from_host_value(json!({
            "name": "host_internal_preview",
            "preview": "dry-run",
            "nested": {
                "count": 2
            }
        }))
        .expect("ui request should parse");

        assert_eq!(request.name, "host_internal_preview");
        assert_eq!(
            request.arguments,
            json!({
                "preview": "dry-run",
                "nested": {
                    "count": 2
                }
            })
        );
    }

    #[test]
    fn retired_builtin_host_methods_stay_on_host_internal_side() {
        fn is_retired(method: &str) -> bool {
            matches!(
                method,
                "host.builtinToolDefinitionEnvironment"
                    | "host.parseCommand"
                    | "host.requestFromFunctionCall"
                    | "host.authorize"
                    | "host.trust"
                    | "host.execute"
            )
        }

        for method in [
            "host.builtinToolDefinitionEnvironment",
            "host.parseCommand",
            "host.requestFromFunctionCall",
            "host.authorize",
            "host.trust",
            "host.execute",
        ] {
            assert!(
                is_retired(method),
                "{method} should not fall back to Rust CLI tool runtime"
            );
        }

        assert!(!is_retired("host.addMcpServer"));
        assert!(!is_retired("host.localToolExecuted"));
    }
}
