use anyhow::{Result, anyhow};
use serde_json::json;
use std::path::{Path, PathBuf};

use crate::{
    hooks_types::{HookListItem, HooksValidationReport},
    plan::PlanMetadata,
    skills::ActiveSkillPayload,
    ts_bridge::{
        types::bridge::{BridgeRuntimeSnapshot, BridgeWorkspaceFileReferenceSuggestions},
        types::CliHostMetadataSnapshot,
        TsBridgeRuntime,
    },
};

impl TsBridgeRuntime {
    pub fn replace_plan_metadata(&mut self, metadata: PlanMetadata) {
        self.plan_metadata = metadata;
        if !self.plan_metadata.path.as_os_str().is_empty() {
            self.active_plan_path = Some(self.plan_metadata.path.clone());
        }
        if self.bridge_failed {
            return;
        }

        let snapshot = match self.call_bridge(
            "runtime.replacePlanMetadata",
            Some(json!({
                "planMetadata": self.plan_metadata,
            })),
        ) {
            Ok(value) => value,
            Err(err) => {
                self.handle_bridge_error(err);
                return;
            }
        };

        match serde_json::from_value::<BridgeRuntimeSnapshot>(snapshot) {
            Ok(snapshot) => self.apply_snapshot(snapshot),
            Err(err) => self.handle_bridge_error(anyhow!(
                "解析 TS replacePlanMetadata snapshot 失败: {}",
                err
            )),
        }
    }

    pub fn activate_skill(&mut self, skill: ActiveSkillPayload) -> Result<()> {
        if self.bridge_failed {
            return Err(anyhow!("TS bridge 已失效，无法激活 skill"));
        }

        let snapshot = self.call_bridge(
            "runtime.activateSkill",
            Some(json!({
                "skill": skill,
            })),
        )?;
        self.apply_snapshot(serde_json::from_value(snapshot)?);
        Ok(())
    }

    pub fn has_active_plan(&self) -> bool {
        self.active_plan_path
            .as_ref()
            .is_some_and(|path| !path.as_os_str().is_empty())
    }

    pub fn active_plan_path(&self) -> Option<&Path> {
        self.active_plan_path.as_deref()
    }

    pub fn load_cli_host_metadata(&mut self, agent_mode: &str) -> Result<CliHostMetadataSnapshot> {
        let value = self.call_bridge(
            "hostInternal.loadCliMetadata",
            Some(json!({
                "agentMode": agent_mode,
                "activePlanPath": self.active_plan_path.as_ref().map(|path| path.display().to_string()),
            })),
        )?;
        let metadata: CliHostMetadataSnapshot = serde_json::from_value(value)?;
        self.plan_metadata = metadata.plan_metadata.clone();
        Ok(metadata)
    }

    pub fn load_plan_metadata(&mut self, agent_mode: &str) -> Result<PlanMetadata> {
        let value = self.call_bridge(
            "hostInternal.loadPlanMetadata",
            Some(json!({
                "agentMode": agent_mode,
                "activePlanPath": self.active_plan_path.as_ref().map(|path| path.display().to_string()),
            })),
        )?;
        Ok(serde_json::from_value(value)?)
    }

    pub fn list_workspace_file_reference_suggestions(
        &mut self,
        input: &str,
        cursor_chars: usize,
    ) -> Result<(Vec<String>, bool)> {
        let value = self.call_bridge(
            "hostInternal.listWorkspaceFileReferenceSuggestions",
            Some(json!({
                "input": input,
                "cursorChars": cursor_chars,
            })),
        )?;

        if value.is_null() {
            return Ok((Vec::new(), true));
        }

        let suggestions: BridgeWorkspaceFileReferenceSuggestions = serde_json::from_value(value)?;
        Ok((
            suggestions.suggestions,
            suggestions.index_ready.unwrap_or(true),
        ))
    }

    pub fn prime_workspace_file_reference_index(&mut self) -> Result<()> {
        self.call_bridge("hostInternal.primeWorkspaceFileReferenceIndex", None)?;
        Ok(())
    }

    pub fn write_rule_state(
        &mut self,
        enabled_overrides: std::collections::BTreeMap<String, bool>,
    ) -> Result<PathBuf> {
        let value = self.call_bridge(
            "hostInternal.writeRuleState",
            Some(json!({
                "enabledOverrides": enabled_overrides,
            })),
        )?;
        let path = value
            .as_str()
            .ok_or_else(|| anyhow!("hostInternal.writeRuleState 返回值无效"))?;
        Ok(PathBuf::from(path))
    }

    pub fn write_skill_state(
        &mut self,
        enabled_overrides: std::collections::BTreeMap<String, bool>,
    ) -> Result<PathBuf> {
        let value = self.call_bridge(
            "hostInternal.writeSkillState",
            Some(json!({
                "enabledOverrides": enabled_overrides,
            })),
        )?;
        let path = value
            .as_str()
            .ok_or_else(|| anyhow!("hostInternal.writeSkillState 返回值无效"))?;
        Ok(PathBuf::from(path))
    }

    pub fn reload_host_metadata(&mut self, agent_mode: &str) -> Result<()> {
        let value = self.call_bridge(
            "runtime.reloadHostMetadata",
            Some(json!({
                "agentMode": agent_mode,
                "activePlanPath": self.active_plan_path.as_ref().map(|path| path.display().to_string()),
            })),
        )?;
        self.apply_snapshot(serde_json::from_value(value)?);
        Ok(())
    }

    pub fn validate_hooks(&mut self, workspace_root: Option<&str>) -> Result<HooksValidationReport> {
        let params = workspace_root.map(|root| json!({ "workspaceRoot": root }));
        let value = self.call_bridge("hostInternal.validateHooks", params)?;
        Ok(serde_json::from_value(value)?)
    }

    pub fn list_hook_entries(&mut self, workspace_root: Option<&str>) -> Result<Vec<HookListItem>> {
        let params = workspace_root.map(|root| json!({ "workspaceRoot": root }));
        let value = self.call_bridge("hostInternal.listHookEntries", params)?;
        Ok(serde_json::from_value(value)?)
    }

    pub fn save_hook_entry(
        &mut self,
        workspace_binding: Option<&str>,
        request: &crate::hooks_types::SaveHookEntryRequest,
    ) -> Result<()> {
        let mut params = json!({ "request": request });
        if let Some(obj) = params.as_object_mut() {
            if let Some(binding) = workspace_binding {
                obj.insert("workspaceBinding".to_string(), json!(binding));
            }
        }
        self.call_bridge("hostInternal.saveHookEntry", Some(params))?;
        Ok(())
    }
}
