use anyhow::{Result, anyhow};
use serde_json::{Map, Value, json};

use crate::host_runtime::ToolUiRequest;
use crate::ts_bridge::types::bridge::LocalMcpToolRequest;

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


pub(crate) fn tool_request_from_local_mcp(request: &LocalMcpToolRequest) -> ToolUiRequest {
    ToolUiRequest::new(
        "mcp_tool",
        json!({
            "server": request.server,
            "display_name": request.display_name,
            "tool_name": request.tool_name,
            "arguments": request.arguments,
        }),
    )
}

pub(crate) fn is_retired_builtin_host_method(method: &str) -> bool {
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