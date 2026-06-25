use anyhow::{anyhow, Result};
use serde_json::{json, Value};
use std::path::PathBuf;

use crate::{
    mcp::{add_mcp_server, McpServerConfig, McpScope},
    mcp_types::{
        ManagedMcpServer, McpDiscoveredPrompt, McpDiscoveredResource, McpDiscoveredTool,
        McpServerInspection,
    },
    ts_bridge::TsBridgeRuntime,
};

impl TsBridgeRuntime {
    pub fn list_mcp_servers(&mut self) -> Result<Vec<ManagedMcpServer>> {
        let value = self.call_bridge("runtime.listMcpServers", None)?;
        Ok(serde_json::from_value(value)?)
    }

    pub fn inspect_mcp_server(&mut self, name: &str) -> Result<McpServerInspection> {
        let value = self.call_bridge("runtime.inspectMcpServer", Some(json!({ "name": name })))?;
        Ok(serde_json::from_value(value)?)
    }

    pub fn list_mcp_tools(&mut self, name: &str) -> Result<Vec<McpDiscoveredTool>> {
        let value = self.call_bridge("runtime.listMcpTools", Some(json!({ "name": name })))?;
        Ok(serde_json::from_value(value)?)
    }

    pub fn list_mcp_resources(&mut self, name: &str) -> Result<Vec<McpDiscoveredResource>> {
        let value = self.call_bridge("runtime.listMcpResources", Some(json!({ "name": name })))?;
        Ok(serde_json::from_value(value)?)
    }

    pub fn list_mcp_prompts(&mut self, name: &str) -> Result<Vec<McpDiscoveredPrompt>> {
        let value = self.call_bridge("runtime.listMcpPrompts", Some(json!({ "name": name })))?;
        Ok(serde_json::from_value(value)?)
    }

    pub fn list_cached_mcp_prompts(&mut self, name: &str) -> Result<Vec<McpDiscoveredPrompt>> {
        let value = self.call_bridge(
            "runtime.listCachedMcpPrompts",
            Some(json!({ "name": name })),
        )?;
        Ok(serde_json::from_value(value)?)
    }

    pub fn read_mcp_resource_value(&mut self, server: &str, uri: &str) -> Result<Value> {
        self.call_bridge(
            "runtime.readMcpResource",
            Some(json!({ "server": server, "uri": uri })),
        )
    }

    pub fn get_mcp_prompt_value(
        &mut self,
        server: &str,
        prompt: &str,
        args_json: Option<&str>,
    ) -> Result<Value> {
        let mut params = json!({
            "server": server,
            "prompt": prompt,
        });
        if let Some(args_json) = args_json {
            params["argsJson"] = Value::String(args_json.to_string());
        }

        self.call_bridge("runtime.getMcpPrompt", Some(params))
    }

    pub fn call_mcp_tool_value(
        &mut self,
        server: &str,
        tool_name: &str,
        args_json: Option<&str>,
    ) -> Result<Value> {
        let mut params = json!({
            "server": server,
            "tool": tool_name,
        });
        if let Some(args_json) = args_json {
            params["argsJson"] = Value::String(args_json.to_string());
        }

        self.call_bridge("runtime.callMcpTool", Some(params))
    }

    pub fn attach_mcp_resource(&mut self, server: &str, uri: &str) -> Result<String> {
        let value = self.call_bridge(
            "runtime.attachMcpResource",
            Some(json!({ "server": server, "uri": uri })),
        )?;
        let snapshot = value
            .get("snapshot")
            .cloned()
            .ok_or_else(|| anyhow!("TS attachMcpResource 未返回 snapshot"))?;
        let label = value
            .get("label")
            .and_then(Value::as_str)
            .ok_or_else(|| anyhow!("TS attachMcpResource 未返回 label"))?
            .to_string();
        self.apply_snapshot(serde_json::from_value(snapshot)?);
        Ok(label)
    }

    pub fn clear_pending_mcp_resources(&mut self) -> usize {
        let cleared = match self.call_bridge("runtime.clearPendingMcpResources", None) {
            Ok(value) => value.as_u64().unwrap_or(0) as usize,
            Err(err) => {
                self.handle_bridge_error(err);
                return 0;
            }
        };
        if let Err(err) = self.sync_snapshot_only() {
            self.handle_bridge_error(err);
        }
        cleared
    }

    pub fn apply_mcp_prompt(
        &mut self,
        server: &str,
        prompt: &str,
        args_json: Option<&str>,
        user_message: Option<&str>,
    ) -> Result<String> {
        let mut params = json!({
            "server": server,
            "prompt": prompt,
        });
        if let Some(args_json) = args_json {
            params["argsJson"] = Value::String(args_json.to_string());
        }
        if let Some(user_message) = user_message {
            params["userMessage"] = Value::String(user_message.to_string());
        }
        let value = self.call_bridge("runtime.applyMcpPrompt", Some(params))?;
        let notice = value
            .get("notice")
            .and_then(Value::as_str)
            .ok_or_else(|| anyhow!("TS applyMcpPrompt 未返回 notice"))?
            .to_string();
        self.sync_after_command()?;
        Ok(notice)
    }

    pub fn add_mcp_server(&mut self, scope: McpScope, name: &str, config: McpServerConfig) -> Result<PathBuf> {
        let path = add_mcp_server(&self.workspace_root, scope, name, config)?;
        let _ = self.call_bridge("runtime.startMcpBackgroundRefresh", None)?;
        Ok(path)
    }

    pub fn execute_mcp_tool(
        &mut self,
        server: &str,
        tool_name: &str,
        args_json: Option<&str>,
    ) -> Result<()> {
        let mut params = json!({
            "server": server,
            "tool": tool_name,
        });
        if let Some(args_json) = args_json {
            params["argsJson"] = Value::String(args_json.to_string());
        }

        let value = self.call_bridge("runtime.startManualMcpTool", Some(params))?;
        self.handle_manual_tool_command_bridge_response(&value)?;
        self.sync_after_command()?;
        Ok(())
    }
}
