use anyhow::{anyhow, Result};
use serde_json::{json, Value};

use crate::{
    logging,
    plan,
    rewind,
    ts_bridge::{types::bridge::BridgeRuntimeSnapshot, TsBridgeRuntime},
    view::PendingAssistantAux,
};

impl TsBridgeRuntime {
    pub fn pending_aux_state(&self) -> Option<PendingAssistantAux> {
        self.pending_aux_state.clone()
    }

    pub fn submit_user_turn(
        &mut self,
        text: String,
        explicit_images: Option<Vec<String>>,
    ) -> Result<()> {
        if self.bridge_failed {
            return Err(anyhow!("TS bridge 已处于失败状态。"));
        }
        let mut params = json!({ "text": text });
        if let Some(images) = explicit_images {
            params["explicitImages"] = serde_json::to_value(images).unwrap_or(Value::Array(vec![]));
        }
        logging::log_event(&format!(
            "[ts-bridge-host] submit_user_turn chars={} explicit_images={}",
            text.chars().count(),
            params
                .get("explicitImages")
                .and_then(Value::as_array)
                .map(|items| items.len())
                .unwrap_or(0)
        ));
        if let Err(err) = self.call_bridge("runtime.submitUserTurn", Some(params)) {
            let message = err.to_string();
            self.handle_bridge_error(anyhow!(message.clone()));
            return Err(anyhow!(message));
        }
        if let Err(err) = self.sync_after_command() {
            let message = err.to_string();
            self.handle_bridge_error(anyhow!(message.clone()));
            return Err(anyhow!(message));
        }
        Ok(())
    }

    pub fn compact_history(&mut self) {
        if self.bridge_failed {
            return;
        }
        if let Err(err) = self.call_bridge("runtime.startManualHistoryCompaction", None) {
            self.handle_bridge_error(err);
            return;
        }

        if let Err(err) = self.sync_after_command() {
            self.handle_bridge_error(err);
        }
    }

    pub fn replace_session_from_archive(&mut self, archive: &crate::ports::ChatArchive) {
        if let Err(err) = self.replace_runtime_archive(archive) {
            self.handle_bridge_error(err);
            return;
        }
        self.rewind = rewind::normalize_desktop_rewind_metadata(archive.rewind.as_ref());
        self.active_plan_path =
            plan::extract_active_plan_path_from_archived_llm_history(&archive.llm_history);
        self.plan_metadata = plan::plan_metadata_snapshot(
            self.plan_metadata.spirit_agent_mode(),
            self.active_plan_path.as_deref(),
        );
    }

    pub fn activate_forked_session(
        &mut self,
        archive: &crate::ports::ChatArchive,
        todos: Vec<rewind::HostTodoRecord>,
    ) -> Result<()> {
        self.replace_runtime_archive(archive)?;
        self.rewind = rewind::normalize_desktop_rewind_metadata(archive.rewind.as_ref());
        self.active_plan_path =
            plan::extract_active_plan_path_from_archived_llm_history(&archive.llm_history);
        self.plan_metadata = plan::plan_metadata_snapshot(
            self.plan_metadata.spirit_agent_mode(),
            self.active_plan_path.as_deref(),
        );
        let session_key = self.rewind.session_id.clone();
        self.set_todo_session_key(&session_key)?;
        self.replace_session_todos(todos)?;
        Ok(())
    }

    pub fn reset_session(&mut self) -> Result<()> {
        if self.bridge_failed {
            return Err(anyhow!("TS bridge 已失效，无法开始新会话"));
        }
        let new_rewind = rewind::create_desktop_rewind_metadata();
        let archive = crate::ports::ChatArchive {
            messages: vec![],
            assistant_aux: vec![],
            llm_history: vec![],
            loop_enabled: false,
            approval_level: "default".to_string(),
            subagent_sessions: vec![],
            desktop_messages: None,
            rewind: Some(new_rewind.as_json()),
            session_display_name: None,
        };
        self.replace_runtime_archive(&archive)?;
        self.rewind = new_rewind;
        self.active_plan_path = None;
        self.plan_metadata = plan::plan_metadata_snapshot(
            self.plan_metadata.spirit_agent_mode(),
            None,
        );
        let session_key = self.rewind.session_id.clone();
        self.set_todo_session_key(&session_key)?;
        self.replace_session_todos(vec![])?;
        Ok(())
    }

    pub fn add_pending_image(&mut self, path: String) {
        if self.bridge_failed {
            return;
        }
        let value = match self.call_bridge("runtime.addPendingImage", Some(json!({ "path": path })))
        {
            Ok(value) => value,
            Err(err) => {
                self.handle_bridge_error(err);
                return;
            }
        };

        match serde_json::from_value::<BridgeRuntimeSnapshot>(value) {
            Ok(snapshot) => self.apply_snapshot(snapshot),
            Err(err) => {
                self.handle_bridge_error(anyhow!("解析 TS addPendingImage snapshot 失败: {}", err))
            }
        }
    }

    pub fn clear_pending_images(&mut self) -> usize {
        if self.bridge_failed {
            return 0;
        }
        let cleared = match self.call_bridge("runtime.clearPendingImages", None) {
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
}
