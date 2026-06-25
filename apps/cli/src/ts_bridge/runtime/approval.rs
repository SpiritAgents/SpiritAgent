use anyhow::{anyhow, Result};
use serde_json::json;

use crate::{
    ts_bridge::{tool_ui::approval_decision_from_input, PendingApprovalKind, TsBridgeRuntime},
};

impl TsBridgeRuntime {
    pub fn has_pending_tool_approval(&self) -> bool {
        self.pending_approval_kind.is_some()
    }

    pub fn is_busy(&self) -> bool {
        self.is_busy_cache
    }

    pub fn loop_enabled(&self) -> bool {
        self.session.loop_enabled()
    }

    pub fn set_loop_enabled(&mut self, enabled: bool) -> Result<()> {
        if self.bridge_failed {
            return Err(anyhow!("TS bridge 已处于失败状态。"));
        }
        let value = self.call_bridge(
            "runtime.setLoopEnabled",
            Some(json!({
                "enabled": enabled,
            })),
        )?;
        self.apply_snapshot(serde_json::from_value(value)?);
        Ok(())
    }

    pub fn approval_level(&self) -> &str {
        self.session.approval_level()
    }

    pub fn set_approval_level(&mut self, approval_level: &str) -> Result<()> {
        if self.bridge_failed {
            return Err(anyhow!("TS bridge 已处于失败状态。"));
        }
        let normalized = crate::ports::normalize_approval_level(approval_level);
        let value = self.call_bridge(
            "runtime.setApprovalLevel",
            Some(json!({
                "approvalLevel": normalized,
            })),
        )?;
        self.apply_snapshot(serde_json::from_value(value)?);
        Ok(())
    }

    pub fn respond_to_pending_tool_approval(&mut self, message: &str) {
        if self.bridge_failed {
            return;
        }
        let decision = approval_decision_from_input(message);
        let pending_kind = self.pending_approval_kind;
        let method = match pending_kind {
            Some(PendingApprovalKind::Manual) => "runtime.continuePendingManualToolApproval",
            Some(PendingApprovalKind::Tool) => "runtime.respondToPendingApproval",
            None => return,
        };

        let value = match self.call_bridge(method, Some(json!({ "decision": decision }))) {
            Ok(value) => value,
            Err(err) => {
                self.handle_bridge_error(err);
                return;
            }
        };

        if pending_kind == Some(PendingApprovalKind::Manual)
            && let Err(err) = self.handle_manual_tool_command_bridge_response(&value)
        {
            self.handle_bridge_error(err);
            return;
        }

        if let Err(err) = self.sync_after_command() {
            self.handle_bridge_error(err);
        }
    }

    pub fn respond_to_pending_questions(
        &mut self,
        result: &crate::ask_questions::AskQuestionsResult,
    ) {
        if self.bridge_failed {
            return;
        }

        if let Err(err) = self.call_bridge(
            "runtime.respondToPendingQuestions",
            Some(json!({ "result": result })),
        ) {
            self.handle_bridge_error(err);
            return;
        }

        if let Err(err) = self.sync_after_command() {
            self.handle_bridge_error(err);
        }
    }

    pub fn execute_manual_tool_command(&mut self, message: &str) {
        if self.bridge_failed {
            return;
        }
        let value = match self.call_bridge(
            "runtime.startManualToolCommand",
            Some(json!({ "message": message })),
        ) {
            Ok(value) => value,
            Err(err) => {
                self.handle_bridge_error(err);
                return;
            }
        };

        if let Err(err) = self.handle_manual_tool_command_bridge_response(&value) {
            self.handle_bridge_error(err);
            return;
        }

        if let Err(err) = self.sync_after_command() {
            self.handle_bridge_error(err);
        }
    }
}
