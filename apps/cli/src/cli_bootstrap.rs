use anyhow::{anyhow, Result};
use rust_i18n::t;

use crate::{
    adapters::JsonConfigStore,
    locale::{self, available_ui_locales_csv, parse_ui_locale},
    model_registry::AppConfig,
    ports::{
        available_approval_levels_csv, parse_approval_level_strict, ConfigStore,
    },
    runtime_handle::RuntimeHandle,
};

#[derive(Clone, Debug, Default)]
pub struct GlobalCliOptions {
    pub prompt: Option<String>,
    pub model: Option<String>,
    pub approval: Option<String>,
    pub language: Option<String>,
}

pub fn list_model_ids(config: &AppConfig) -> Vec<String> {
    config
        .flatten_models()
        .into_iter()
        .map(|model| model.name)
        .collect()
}

pub fn available_models_csv(config: &AppConfig) -> String {
    list_model_ids(config).join(", ")
}

pub fn model_not_found_message(name: &str, config: &AppConfig) -> String {
    t!(
        "cli.model.not_found",
        name = name,
        available = available_models_csv(config)
    )
    .into_owned()
}

/// Load config, apply `--language` (persist), then `--model` (persist). Locale is set before
/// any further CLI output. Does not touch approval (needs a live runtime).
pub fn bootstrap_config(options: &GlobalCliOptions) -> Result<AppConfig> {
    let config_store = JsonConfigStore;
    let mut config = config_store.load()?;

    // Apply locale from env/config first so unknown --language errors are localized.
    locale::apply_ui_locale(&config);

    if let Some(raw) = options.language.as_deref() {
        let Some(normalized) = parse_ui_locale(raw) else {
            return Err(anyhow!(
                "{}",
                t!(
                    "cli.language.unsupported",
                    code = raw,
                    available = available_ui_locales_csv()
                )
            ));
        };
        config.ui_locale = Some(normalized.clone());
        config_store.save(&config)?;
        rust_i18n::set_locale(&normalized);
    }

    if let Some(model) = options.model.as_deref() {
        apply_active_model(model, &mut config, &config_store)?;
    }

    // Validate early so unknown --approval fails before TUI/headless init.
    if let Some(raw) = options.approval.as_deref() {
        let _ = parse_cli_approval_level(raw)?;
    }

    Ok(config)
}

pub fn apply_active_model(
    selector: &str,
    config: &mut AppConfig,
    config_store: &dyn ConfigStore,
) -> Result<()> {
    let trimmed = selector.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("{}", t!("cli.model.selector_empty")));
    }

    match config.parse_model_ref_selector(trimmed) {
        Ok(model_ref) => {
            config.active_model = model_ref;
            config_store.save(config)?;
            Ok(())
        }
        Err(err) => {
            let missing = if let Some((group_id, name)) = trimmed.split_once("::") {
                let model_ref = crate::model_registry::ModelRef {
                    group_id: group_id.trim().to_string(),
                    name: name.trim().to_string(),
                };
                !config.model_ref_exists(&model_ref)
            } else {
                config.find_model_refs_by_name(trimmed).is_empty()
            };
            if missing {
                return Err(anyhow!("{}", model_not_found_message(trimmed, config)));
            }
            Err(anyhow!(
                "{}",
                t!(
                    "cli.model.selector_failed",
                    err = err,
                    available = available_models_csv(config)
                )
            ))
        }
    }
}

pub fn parse_cli_approval_level(raw: &str) -> Result<String> {
    parse_approval_level_strict(raw).ok_or_else(|| {
        anyhow!(
            "{}",
            t!(
                "cli.approval.unsupported",
                level = raw,
                available = available_approval_levels_csv()
            )
        )
    })
}

pub fn apply_approval_level(runtime: &mut RuntimeHandle, raw: &str) -> Result<()> {
    let level = parse_cli_approval_level(raw)?;
    runtime.set_approval_level(&level)
}

pub fn print_skills_stub() {
    println!("{}", t!("cli.skills.header"));
    println!("{}", t!("cli.skills.file"));
    println!("{}", t!("cli.skills.shell"));
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model_registry::{ModelEntry, ModelProvider, ModelRef, ProviderGroup};

    fn config_with_models(names: &[&str]) -> AppConfig {
        let models = names
            .iter()
            .map(|name| ModelEntry {
                name: (*name).to_string(),
                reasoning_effort: None,
                thinking_enabled: None,
                supported_reasoning_efforts: None,
                capabilities: None,
                context_length: None,
                supports_thinking_type: None,
                supports_thinking_switch: None,
            })
            .collect();
        AppConfig {
            active_model: ModelRef {
                group_id: "g".to_string(),
                name: names.first().copied().unwrap_or("m").to_string(),
            },
            provider_groups: vec![ProviderGroup {
                id: "g".to_string(),
                provider: ModelProvider::Custom,
                label: None,
                api_base: "https://example.com/v1".to_string(),
                transport_kind: Some("openai-compatible".to_string()),
                provider_site: None,
                alibaba_workspace_id: None,
                alibaba_billing_mode: None,
                stepfun_billing_mode: None,
                z_ai_billing_mode: None,
                zhipu_billing_mode: None,
                aws_region: None,
                azure_resource_name: None,
                cloudflare_account_id: None,
                cloudflare_gateway_id: None,
                vertex_project: None,
                vertex_location: None,
                models,
            }],
            ..AppConfig::default()
        }
    }

    #[test]
    fn available_models_csv_joins_with_comma_space() {
        let config = config_with_models(&["alpha", "beta"]);
        assert_eq!(available_models_csv(&config), "alpha, beta");
    }

    #[test]
    fn model_not_found_message_includes_available_list() {
        rust_i18n::set_locale("en");
        let config = config_with_models(&["k3", "kimi-for-coding"]);
        let message = model_not_found_message("missing", &config);
        assert!(message.contains("missing"));
        assert!(message.contains("k3, kimi-for-coding"));
    }

    #[test]
    fn parse_cli_approval_level_errors_list_available() {
        rust_i18n::set_locale("en");
        let err = parse_cli_approval_level("nope").unwrap_err().to_string();
        assert!(err.contains("nope"));
        assert!(err.contains("default, auto-approval, full-approval"));
    }
}
