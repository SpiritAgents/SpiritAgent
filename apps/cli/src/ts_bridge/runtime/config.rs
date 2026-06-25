use anyhow::{Result, anyhow};
use serde_json::json;
use std::env;

use crate::{
    host_runtime::RuntimeEvent,
    model_registry::AppConfig,
    ts_bridge::TsBridgeRuntime,
    view::{ChatMessage, MessageRole},
};

impl TsBridgeRuntime {
        pub(crate) fn apply_transport_to_bridge(&mut self) {
        let pending_images = self.session.pending_image_paths().to_vec();
        let pending_resources = self.session.pending_mcp_resources().to_vec();
        let transport_config = match self.resolve_transport_config_json() {
            Ok(value) => value,
            Err(err) => {
                self.handle_bridge_error(err);
                return;
            }
        };

        if let Err(err) = self.call_bridge(
            "runtime.replaceConfig",
            Some(json!({
                "transportConfig": transport_config,
            })),
        ) {
            self.handle_bridge_error(err);
            return;
        }

        if let Err(err) = self.sync_snapshot_only() {
            self.handle_bridge_error(err);
            return;
        }

        for path in pending_images {
            self.add_pending_image(path);
        }
        for resource in pending_resources {
            if let Err(err) = self.attach_mcp_resource(&resource.server, &resource.uri) {
                self.handle_bridge_error(err);
                return;
            }
        }
    }

    pub(crate) fn flush_deferred_transport_replace(&mut self) {
        if !self.deferred_transport_replace {
            return;
        }
        if self.is_busy_cache || self.session.pending_user_turn().is_some() {
            return;
        }
        self.deferred_transport_replace = false;
        self.apply_transport_to_bridge();
    }

    pub fn replace_config(&mut self, config: AppConfig) {
        let transport_config_changed = self.transport_config_will_change(&config);
        if let Err(err) = self.validate_config_change(&config) {
            self.events
                .push_back(RuntimeEvent::PushMessage(ChatMessage::new(
                    MessageRole::Agent,
                    err.to_string(),
                )));
            return;
        }

        if !transport_config_changed {
            self.config = config;
            if let Err(err) = self.apply_llm_http_version_from_config() {
                self.handle_bridge_error(err);
            }
            return;
        }

        let busy_defer = self.is_busy_cache || self.session.pending_user_turn().is_some();
        self.config = config;
        if let Err(err) = self.apply_llm_http_version_from_config() {
            self.handle_bridge_error(err);
        }

        if busy_defer {
            self.deferred_transport_replace = true;
            return;
        }

        self.deferred_transport_replace = false;
        self.apply_transport_to_bridge();
    }

    pub(crate) fn apply_llm_http_version_from_config(&mut self) -> Result<()> {
        if self.bridge_failed {
            return Err(anyhow!("TS bridge 已处于失败状态。"));
        }
        let version = self.config.networks.llm_http_version.clone();
        self.set_llm_http_version(&version)
    }

    pub(crate) fn apply_llm_client_version_from_build(&mut self) -> Result<()> {
        if self.bridge_failed {
            return Err(anyhow!("TS bridge 已处于失败状态。"));
        }
        self.set_llm_client_version(env!("CARGO_PKG_VERSION"))
    }

    pub fn store_config(&mut self, config: AppConfig) {
        self.config = config;
    }

    pub fn set_llm_http_version(&mut self, llm_http_version: &str) -> Result<()> {
        if self.bridge_failed {
            return Err(anyhow!("TS bridge 已处于失败状态。"));
        }
        let normalized = crate::ports::normalize_llm_http_version(llm_http_version);
        self.call_bridge(
            "runtime.setLlmHttpVersion",
            Some(json!({
                "llmHttpVersion": normalized,
            })),
        )?;
        Ok(())
    }

    pub fn set_llm_client_version(&mut self, client_version: &str) -> Result<()> {
        if self.bridge_failed {
            return Err(anyhow!("TS bridge 已处于失败状态。"));
        }
        self.call_bridge(
            "runtime.setLlmClientVersion",
            Some(json!({
                "clientVersion": client_version,
            })),
        )?;
        Ok(())
    }
    #[cfg(test)]
    pub(crate) fn deferred_transport_replace_for_test(&self) -> bool {
        self.deferred_transport_replace
    }
}
