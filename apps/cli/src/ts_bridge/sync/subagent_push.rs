use anyhow::Result;
use serde_json::Value;

use crate::{
    host_runtime::RuntimeEvent,
    logging,
    ts_bridge::{
        TsBridgeRuntime,
        types::bridge::{BridgeManualToolCommandStartResult, LocalMcpToolFailedEvent, LocalMcpToolResultEvent},
    },
    view::{ChatMessage, MessageRole},
};

impl TsBridgeRuntime {
    pub(crate) fn push_local_mcp_tool_result(&mut self, event: LocalMcpToolResultEvent) {
        self.sync.push_local_mcp_tool_result(event);
    }

    pub(crate) fn push_local_mcp_tool_failure(&mut self, event: LocalMcpToolFailedEvent) {
        self.sync.push_local_mcp_tool_failure(event);
    }

    pub(crate) fn handle_manual_tool_command_bridge_response(&mut self, value: &Value) -> Result<()> {
        let Some(result_value) = value.get("result").cloned() else {
            return Ok(());
        };

        let result: BridgeManualToolCommandStartResult = serde_json::from_value(result_value)?;
        self.handle_manual_tool_command_result(result);
        Ok(())
    }

    pub(crate) fn handle_manual_tool_command_result(&mut self, result: BridgeManualToolCommandStartResult) {
        self.sync.handle_manual_tool_command_result(result);
    }

    pub(crate) fn handle_bridge_error(&mut self, err: anyhow::Error) {
        let mut summary = err.to_string();
        let fatal = !summary.starts_with("runtime-error: ");
        if let Some(stripped) = summary.strip_prefix("runtime-error: ") {
            summary = stripped.to_string();
        }

        if fatal && self.bridge_failed {
            logging::log_event(&format!(
                "[ts-bridge-host] suppress repeated fatal error: {}",
                summary
            ));
            return;
        }

        if fatal {
            self.bridge_failed = true;
        }
        logging::log_event(&format!(
            "[ts-bridge-host] {}: {}",
            if fatal {
                "fatal error"
            } else {
                "runtime error"
            },
            summary
        ));
        let had_inflight_response = self.sync.is_busy_cache || self.sync.pending_aux_state.is_some();
        let had_pending_output = self.sync.pending_assistant_has_output;
        self.sync.is_busy_cache = false;
        self.sync.pending_aux_state = None;
        self.sync.pending_approval_kind = None;
        self.sync.pending_assistant_has_output = false;
        self.sync.session.clear_pending_user_turn();
        if had_inflight_response {
            self.sync.events.push_back(if had_pending_output {
                RuntimeEvent::AssistantResponseCompleted
            } else {
                RuntimeEvent::RemovePendingAssistant
            });
        }
        self.sync
            .events
            .push_back(RuntimeEvent::PushMessage(ChatMessage::new(
                MessageRole::Agent,
                if fatal {
                    format!("TS runtime bridge 失败: {}", summary)
                } else {
                    format!("TS runtime 执行失败: {}", summary)
                },
            )));
        self.flush_deferred_transport_replace();
    }
}
