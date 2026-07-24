use anyhow::{Result, anyhow};
use serde_json::{Value, json};

use crate::{
    logging,
    mcp::{McpServerConfig, McpScope, add_mcp_server},
    rewind,
    ts_bridge::{
        tool_ui::is_retired_builtin_host_method,
        types::bridge::{
            LocalMcpToolFailedEvent, LocalMcpToolResultEvent, WorkspaceCapabilityTrustDecision,
            WorkspaceCapabilityTrustRequest,
        },
        TsBridgeRuntime,
    },
};

impl TsBridgeRuntime {
    pub(super) fn handle_host_request(&mut self, message: Value) -> Result<()> {
        let method = message
            .get("method")
            .and_then(Value::as_str)
            .ok_or_else(|| anyhow!("JSON-RPC 请求缺少 method"))?
            .to_string();
        let params = message.get("params").cloned();
        let request_id = message.get("id").and_then(Value::as_u64);

        let response = match self.dispatch_host_method(&method, params) {
            Ok(result) => request_id.map(
                |id| json!({ "jsonrpc": "2.0", "id": id, "result": result.unwrap_or(Value::Null) }),
            ),
            Err(err) => request_id.map(|id| {
                json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "error": {
                        "code": -32000,
                        "message": err.to_string(),
                    }
                })
            }),
        };

        if let Some(response) = response {
            self.process.write_message(&response)?;
        }
        Ok(())
    }

    fn dispatch_host_method(
        &mut self,
        method: &str,
        params: Option<Value>,
    ) -> Result<Option<Value>> {
        match method {
            method if is_retired_builtin_host_method(method) => Err(anyhow!(
                "CLI TS bridge 已切换到 host-internal，本回调不应再被调用: {}",
                method
            )),
            "host.addMcpServer" => {
                let params = params.ok_or_else(|| anyhow!("host.addMcpServer 缺少 params"))?;
                let name = params
                    .get("name")
                    .and_then(Value::as_str)
                    .ok_or_else(|| anyhow!("host.addMcpServer 缺少 name"))?;
                let config: McpServerConfig = serde_json::from_value(
                    params
                        .get("config")
                        .cloned()
                        .ok_or_else(|| anyhow!("host.addMcpServer 缺少 config"))?,
                )?;
                let scope = params
                    .get("scope")
                    .and_then(Value::as_str)
                    .map(|value| {
                        if value.eq_ignore_ascii_case("workspace") {
                            McpScope::Workspace
                        } else {
                            McpScope::User
                        }
                    })
                    .unwrap_or(McpScope::User);
                let path = add_mcp_server(&self.workspace_root, scope, name, config)?;
                Ok(Some(Value::String(path.display().to_string())))
            }
            "host.localToolExecuted" => {
                let params = params.ok_or_else(|| anyhow!("host.localToolExecuted 缺少 params"))?;
                let event: LocalMcpToolResultEvent = serde_json::from_value(params)?;
                self.push_local_mcp_tool_result(event);
                Ok(None)
            }
            "host.localToolFailed" => {
                let params = params.ok_or_else(|| anyhow!("host.localToolFailed 缺少 params"))?;
                let event: LocalMcpToolFailedEvent = serde_json::from_value(params)?;
                self.push_local_mcp_tool_failure(event);
                Ok(None)
            }
            "host.recordFileChange" => {
                let params = params.ok_or_else(|| anyhow!("host.recordFileChange 缺少 params"))?;
                let change: rewind::HostRecordedFileChange = serde_json::from_value(params)?;
                self.record_host_file_change(change)?;
                Ok(None)
            }
            "host.requestWorkspaceCapabilityTrust" => {
                let params = params.ok_or_else(|| {
                    anyhow!("host.requestWorkspaceCapabilityTrust 缺少 params")
                })?;
                let request: WorkspaceCapabilityTrustRequest = serde_json::from_value(params)?;
                // Take the prompter out so the nested UI can redraw without holding it via self.
                let mut prompter = self.workspace_capability_trust_prompter.take();
                let decision = match prompter.as_mut() {
                    Some(prompter) => prompter(request),
                    None => {
                        logging::log_event(
                            "[workspace-trust] no interactive prompter registered; denying",
                        );
                        WorkspaceCapabilityTrustDecision::Deny
                    }
                };
                self.workspace_capability_trust_prompter = prompter;
                Ok(Some(json!({ "decision": decision.as_str() })))
            }
            _ => Err(anyhow!("未知 host callback: {}", method)),
        }
    }
}
