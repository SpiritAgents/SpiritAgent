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
                    locale = raw,
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

pub fn print_verbose_enabled() {
    println!("{}", t!("cli.verbose.enabled"));
}

pub fn print_skills_stub() {
    println!("{}", t!("cli.skills.header"));
    println!("{}", t!("cli.skills.file"));
    println!("{}", t!("cli.skills.shell"));
    println!("{}", t!("cli.skills.schedule"));
}

pub fn print_schedule_list_header() {
    println!("{}", t!("cli.schedule.list_header"));
}

pub fn print_schedule_added(name: &str, cron: &str, task: &str) {
    println!(
        "{}",
        t!(
            "cli.schedule.added",
            name = name,
            cron = cron,
            task = task
        )
    );
}

pub fn print_schedule_removed(name: &str) {
    println!("{}", t!("cli.schedule.removed", name = name));
}
