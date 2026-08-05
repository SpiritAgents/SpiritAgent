mod config;
pub(crate) mod constants;
mod keys;
mod provider;

pub(crate) use config::{resolve_transport_config_json_for, transport_config_will_change};

use std::path::Path;

use crate::{model_registry::AppConfig, ports::SecretStore};

pub(crate) struct TransportHost<'a> {
    pub workspace_root: &'a Path,
    pub secret_store: &'a dyn SecretStore,
    pub stored_config: &'a AppConfig,
}

#[cfg(test)]
mod tests;
