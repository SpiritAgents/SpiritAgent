use anyhow::{Result, anyhow};
use std::env;

use crate::model_registry::ModelProvider;
use crate::transport_config::constants::ENV_API_KEY;

use super::TransportHost;

pub(crate) fn resolve_key_from_store(
    host: &TransportHost<'_>,
    group_id: &str,
    model_name: &str,
    provider: Option<ModelProvider>,
) -> Result<String> {
    if provider == Some(ModelProvider::AmazonBedrock) {
        if let Ok(value) = crate::model_registry::load_group_api_key_from_keyring(group_id) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Ok(trimmed.to_string());
            }
        }
        if crate::model_registry::has_bedrock_runtime_credentials_in_keyring(group_id)? {
            return Ok(String::new());
        }
    } else if provider == Some(ModelProvider::GoogleVertexAi) {
        if let Ok(value) = crate::model_registry::load_group_api_key_from_keyring(group_id) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Ok(trimmed.to_string());
            }
        }
        if let Some(profile) = host.stored_config.active_model_profile()
            && crate::model_registry::has_google_vertex_runtime_credentials(
                "",
                profile.vertex_project().as_deref(),
                profile.vertex_location().as_deref(),
                group_id,
            )
        {
            return Ok(String::new());
        }
    } else if !group_id.trim().is_empty()
        && let Ok(value) = crate::model_registry::load_group_api_key_from_keyring(group_id)
    {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return Ok(trimmed.to_string());
        }
    }
    if let Some(value) = host.secret_store.load_model_api_key(model_name)? {
        return Ok(value);
    }
    if let Some(value) = host.secret_store.load_global_api_key()? {
        return Ok(value);
    }

    if provider == Some(ModelProvider::AmazonBedrock) {
        return Err(anyhow!(
            "No Amazon Bedrock credentials detected. Configure a Bearer API Key or IAM credentials in the Desktop connect wizard, or set the {} environment variable",
            ENV_API_KEY
        ));
    }

    if provider == Some(ModelProvider::GoogleVertexAi) {
        return Err(anyhow!(
            "No Google Vertex AI credentials detected. Configure an Express API Key, a service account (client email + private key), or ADC (fill in project/location and set GOOGLE_APPLICATION_CREDENTIALS / gcloud default credentials), or set the {} environment variable",
            ENV_API_KEY
        ));
    }

    Err(anyhow!(
        "No API Key detected for model {}. Run `spirit model add {} --api-base <url> --key <api_key>` or set the {} environment variable",
        model_name,
        model_name,
        ENV_API_KEY
    ))
}

pub(crate) fn resolve_optional_key_from_store(
    host: &TransportHost<'_>,
    group_id: &str,
    model_name: &str,
    _provider: Option<ModelProvider>,
) -> Result<Option<String>> {
    if let Ok(value) = env::var(ENV_API_KEY) {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return Ok(Some(trimmed.to_string()));
        }
    }
    if !group_id.trim().is_empty()
        && let Ok(value) = crate::model_registry::load_group_api_key_from_keyring(group_id)
    {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return Ok(Some(trimmed.to_string()));
        }
    }
    if let Some(value) = host.secret_store.load_model_api_key(model_name)? {
        return Ok(Some(value));
    }
    host.secret_store.load_global_api_key()
}
