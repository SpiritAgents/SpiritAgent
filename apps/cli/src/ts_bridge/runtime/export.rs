use anyhow::Result;
use serde_json::json;

use crate::{
    logging,
    model_registry::AppConfig,
    ports::{
        AssistantAuxArchiveEntry, ChatArchive, McpStatusSnapshot, SubagentSessionArchiveEntry,
        SubagentSessionSummary,
    },
    runtime_handle::RuntimeExportState,
    session::SessionModel,
    ts_bridge::{
        types::bridge::{BridgeChatArchive, BridgeExportState},
        TsBridgeRuntime,
    },
};

impl TsBridgeRuntime {
    pub fn config(&self) -> &AppConfig {
        &self.config
    }

    pub fn validate_config_change(&self, config: &AppConfig) -> Result<()> {
        if !self.transport_config_will_change(config) {
            return Ok(());
        }

        self.resolve_transport_config_json_for(config).map(|_| ())
    }

    pub fn session(&self) -> &SessionModel {
        &self.session
    }

    pub fn export_llm_state(&mut self) -> Result<RuntimeExportState> {
        let value = self.call_bridge("runtime.exportState", None)?;
        let export: BridgeExportState = serde_json::from_value(value)?;
        Ok(RuntimeExportState {
            api_messages: export.api_messages,
            system_prompts: export.system_prompts,
            api_request_trace: export.request_trace,
        })
    }

    pub fn export_chat_archive(
        &mut self,
        messages: &[(String, String)],
        assistant_aux: &[AssistantAuxArchiveEntry],
    ) -> Result<ChatArchive> {
        let message_values = messages
            .iter()
            .map(|(role, content)| {
                json!({
                    "role": role,
                    "content": content,
                })
            })
            .collect::<Vec<_>>();
        let value = self.call_bridge(
            "runtime.exportArchive",
            Some(json!({
                "messages": message_values,
                "assistantAux": assistant_aux,
            })),
        )?;
        let bridge_archive: BridgeChatArchive = serde_json::from_value(value)?;
        Ok(ChatArchive {
            messages: bridge_archive
                .messages
                .into_iter()
                .map(|message| (message.role, message.content))
                .collect(),
            assistant_aux: bridge_archive
                .assistant_aux
                .into_iter()
                .map(|entry| AssistantAuxArchiveEntry {
                    message_index: entry.message_index,
                    thinking: entry.thinking,
                    compaction: entry.compaction,
                    finish_task_notice: entry.finish_task_notice,
                })
                .collect(),
            llm_history: bridge_archive.llm_history,
            loop_enabled: bridge_archive.loop_enabled,
            approval_level: crate::ports::normalize_approval_level(&bridge_archive.approval_level),
            subagent_sessions: bridge_archive
                .subagent_sessions
                .into_iter()
                .map(|entry| SubagentSessionArchiveEntry {
                    summary: SubagentSessionSummary {
                        session_id: entry.summary.session_id,
                        parent_tool_call_id: entry.summary.parent_tool_call_id,
                        title: entry.summary.title,
                        status: entry.summary.status,
                        started_at_unix_ms: entry.summary.started_at_unix_ms,
                        updated_at_unix_ms: entry.summary.updated_at_unix_ms,
                        completed_at_unix_ms: entry.summary.completed_at_unix_ms,
                        latest_message: entry.summary.latest_message,
                        final_output: entry.summary.final_output,
                        error: entry.summary.error,
                    },
                    llm_history: entry.llm_history,
                })
                .collect(),
            desktop_messages: None,
            rewind: Some(self.rewind.as_json()),
            session_display_name: None,
        })
    }

    pub fn mcp_status_snapshot(&mut self) -> McpStatusSnapshot {
        match self.call_bridge("runtime.mcpStatusSnapshot", None) {
            Ok(value) => serde_json::from_value(value).unwrap_or_default(),
            Err(err) => {
                logging::log_event(&format!(
                    "[ts-bridge-host] read mcpStatusSnapshot failed: {}",
                    err
                ));
                McpStatusSnapshot::default()
            }
        }
    }
}
