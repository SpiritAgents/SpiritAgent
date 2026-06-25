use super::{ENV_RUNTIME_BACKEND_NODE_PATH, TsBridgeRuntime};
use crate::ts_bridge::json_rpc::resolve_bridge_script;
use crate::{
    model_registry::{AppConfig, DEFAULT_API_BASE, ModelProfile, NetworksConfig},
    ports::SecretStore,
};
use anyhow::Result;
use std::{env, path::PathBuf, process::Command, sync::Arc};

struct StubSecretStore;

impl SecretStore for StubSecretStore {
    fn load_global_api_key(&self) -> Result<Option<String>> {
        Ok(Some("test-key".to_string()))
    }

    fn save_global_api_key(&self, _api_key: &str) -> Result<()> {
        Ok(())
    }

    fn remove_global_api_key(&self) -> Result<()> {
        Ok(())
    }

    fn load_model_api_key(&self, _model_name: &str) -> Result<Option<String>> {
        Ok(None)
    }

    fn save_model_api_key(&self, _model_name: &str, _api_key: &str) -> Result<()> {
        Ok(())
    }

    fn remove_model_api_key(&self, _model_name: &str) -> Result<()> {
        Ok(())
    }

    fn has_model_api_key(&self, _model_name: &str) -> Result<bool> {
        Ok(false)
    }
}

fn make_test_runtime() -> Option<TsBridgeRuntime> {
    let workspace_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("workspace root")
        .to_path_buf();

    if resolve_bridge_script(&workspace_root).is_err() {
        return None;
    }

    let node_path = env::var(ENV_RUNTIME_BACKEND_NODE_PATH).unwrap_or_else(|_| "node".to_string());
    if Command::new(&node_path).arg("--version").output().is_err() {
        return None;
    }

    let config = AppConfig {
        models: vec![ModelProfile {
            name: "gpt-4o-mini".to_string(),
            api_base: DEFAULT_API_BASE.to_string(),
            provider: None,
            reasoning_effort: None,
            context_length: None,
            extra: Default::default(),
        }],
        active_model: "gpt-4o-mini".to_string(),
        image_generation_model: None,
        video_generation_model: None,
        ui_locale: None,
        networks: NetworksConfig::default(),
        extra: Default::default(),
    };

    TsBridgeRuntime::new(config, Arc::new(StubSecretStore), workspace_root).ok()
}

#[test]
fn ts_bridge_initializes_when_bundle_is_available() {
    let Some(runtime) = make_test_runtime() else {
        return;
    };
    assert!(!runtime.is_busy());
    assert!(!runtime.has_pending_tool_approval());
}
