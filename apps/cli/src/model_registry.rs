use anyhow::{Context, Result};
use crate::mcp::spirit_agent_data_dir;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::{
    env, fs,
    path::{Path, PathBuf},
    str::FromStr,
};

pub const DEFAULT_API_BASE: &str = "https://api.openai.com/v1";
pub const SPIRIT_CONFIG_SCHEMA_VERSION: u64 = 2;
const ENV_API_KEY: &str = "SPIRIT_API_KEY";
const KEYRING_SERVICE: &str = "SpiritAgent";
const KEYRING_ACCOUNT_API_KEY: &str = "openai_api_key";

/// 与 Desktop `DesktopModelProvider` 及 `config.json` 的 `provider` 字段对齐。
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ModelProvider {
    Deepseek,
    Xai,
    #[serde(rename = "moonshot-ai")]
    Moonshot,
    #[serde(rename = "kimi-code")]
    KimiCode,
    #[serde(rename = "z-ai")]
    ZAi,
    #[serde(rename = "zhipu-ai")]
    ZhipuAi,
    Minimax,
    Xiaomi,
    Siliconflow,
    Alibaba,
    Anthropic,
    #[serde(rename = "vercel-ai-gateway", alias = "vercelaigateway")]
    VercelAiGateway,
    Openrouter,
    #[serde(rename = "fireworks-ai")]
    FireworksAi,
    Openai,
    Google,
    #[serde(rename = "google-vertex-ai")]
    GoogleVertexAi,
    Volcengine,
    #[serde(rename = "amazon-bedrock")]
    AmazonBedrock,
    Azure,
    Custom,
}

impl ModelProvider {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Deepseek => "deepseek",
            Self::Xai => "xai",
            Self::Moonshot => "moonshot-ai",
            Self::KimiCode => "kimi-code",
            Self::ZAi => "z-ai",
            Self::ZhipuAi => "zhipu-ai",
            Self::Minimax => "minimax",
            Self::Xiaomi => "xiaomi",
            Self::Siliconflow => "siliconflow",
            Self::Alibaba => "alibaba",
            Self::Anthropic => "anthropic",
            Self::VercelAiGateway => "vercel-ai-gateway",
            Self::Openrouter => "openrouter",
            Self::FireworksAi => "fireworks-ai",
            Self::Openai => "openai",
            Self::Google => "google",
            Self::GoogleVertexAi => "google-vertex-ai",
            Self::Volcengine => "volcengine",
            Self::AmazonBedrock => "amazon-bedrock",
            Self::Azure => "azure",
            Self::Custom => "custom",
        }
    }
}

impl FromStr for ModelProvider {
    type Err = String;

    fn from_str(value: &str) -> std::result::Result<Self, Self::Err> {
        match value.trim().to_ascii_lowercase().as_str() {
            "deepseek" => Ok(Self::Deepseek),
            "xai" => Ok(Self::Xai),
            "moonshot-ai" => Ok(Self::Moonshot),
            "kimi-code" => Ok(Self::KimiCode),
            "z-ai" => Ok(Self::ZAi),
            "zhipu-ai" => Ok(Self::ZhipuAi),
            "minimax" => Ok(Self::Minimax),
            "xiaomi" => Ok(Self::Xiaomi),
            "siliconflow" => Ok(Self::Siliconflow),
            "alibaba" => Ok(Self::Alibaba),
            "anthropic" => Ok(Self::Anthropic),
            "vercel-ai-gateway" => Ok(Self::VercelAiGateway),
            "openrouter" => Ok(Self::Openrouter),
            "fireworks-ai" => Ok(Self::FireworksAi),
            "openai" => Ok(Self::Openai),
            "google" => Ok(Self::Google),
            "google-vertex-ai" => Ok(Self::GoogleVertexAi),
            "volcengine" => Ok(Self::Volcengine),
            "amazon-bedrock" => Ok(Self::AmazonBedrock),
            "azure" => Ok(Self::Azure),
            "custom" => Ok(Self::Custom),
            other => Err(format!("不支持的 provider: {other}")),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModelTransportKind {
    OpenAiCompatible,
    OpenResponses,
    Anthropic,
    Bedrock,
}

impl ModelTransportKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::OpenAiCompatible => "openai-compatible",
            Self::OpenResponses => "open-responses",
            Self::Anthropic => "anthropic",
            Self::Bedrock => "bedrock",
        }
    }
}

impl FromStr for ModelTransportKind {
    type Err = String;

    fn from_str(value: &str) -> std::result::Result<Self, Self::Err> {
        match value.trim().to_ascii_lowercase().as_str() {
            "openai-compatible" => Ok(Self::OpenAiCompatible),
            "open-responses" => Ok(Self::OpenResponses),
            "anthropic" => Ok(Self::Anthropic),
            "bedrock" => Ok(Self::Bedrock),
            other => Err(format!("不支持的 transport kind: {other}")),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModelRef {
    #[serde(rename = "groupId", alias = "group_id")]
    pub group_id: String,
    pub name: String,
}

impl ModelRef {
    pub fn empty() -> Self {
        Self {
            group_id: String::new(),
            name: String::new(),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.group_id.trim().is_empty() || self.name.trim().is_empty()
    }
}

pub fn model_refs_equal(a: &ModelRef, b: &ModelRef) -> bool {
    a.group_id == b.group_id && a.name == b.name
}

pub fn model_ref_key(model_ref: &ModelRef) -> String {
    format!("{}::{}", model_ref.group_id, model_ref.name)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelEntry {
    pub name: String,
    #[serde(
        rename = "reasoningEffort",
        alias = "reasoning_effort",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub reasoning_effort: Option<String>,
    #[serde(
        rename = "thinkingEnabled",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub thinking_enabled: Option<bool>,
    #[serde(
        rename = "supportedReasoningEfforts",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub supported_reasoning_efforts: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub capabilities: Option<Vec<String>>,
    #[serde(
        rename = "contextLength",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub context_length: Option<u64>,
    #[serde(
        rename = "supportsThinkingType",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub supports_thinking_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderGroup {
    pub id: String,
    pub provider: ModelProvider,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(rename = "apiBase", alias = "api_base")]
    pub api_base: String,
    #[serde(
        rename = "transportKind",
        alias = "transport_kind",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub transport_kind: Option<String>,
    #[serde(
        rename = "providerSite",
        alias = "provider_site",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub provider_site: Option<String>,
    #[serde(
        rename = "alibabaWorkspaceId",
        alias = "alibaba_workspace_id",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub alibaba_workspace_id: Option<String>,
    #[serde(
        rename = "alibabaBillingMode",
        alias = "alibaba_billing_mode",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub alibaba_billing_mode: Option<String>,
    #[serde(
        rename = "awsRegion",
        alias = "aws_region",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub aws_region: Option<String>,
    #[serde(
        rename = "azureResourceName",
        alias = "azure_resource_name",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub azure_resource_name: Option<String>,
    #[serde(
        rename = "cloudflareAccountId",
        alias = "cloudflare_account_id",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub cloudflare_account_id: Option<String>,
    #[serde(
        rename = "cloudflareGatewayId",
        alias = "cloudflare_gateway_id",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub cloudflare_gateway_id: Option<String>,
    #[serde(
        rename = "vertexProject",
        alias = "vertex_project",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub vertex_project: Option<String>,
    #[serde(
        rename = "vertexLocation",
        alias = "vertex_location",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub vertex_location: Option<String>,
    pub models: Vec<ModelEntry>,
}

/// Resolved model profile: provider group connect fields merged with a model entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelProfile {
    #[serde(rename = "groupId", alias = "group_id", default, skip_serializing_if = "String::is_empty")]
    pub group_id: String,
    pub name: String,
    #[serde(rename = "apiBase", alias = "api_base")]
    pub api_base: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider: Option<ModelProvider>,
    #[serde(
        rename = "reasoningEffort",
        alias = "reasoning_effort",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub reasoning_effort: Option<String>,
    #[serde(
        rename = "contextLength",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub context_length: Option<u64>,
    #[serde(flatten, default, skip_serializing_if = "Map::is_empty")]
    pub extra: Map<String, Value>,
}

impl ModelProfile {
    pub fn transport_kind(&self) -> ModelTransportKind {
        self.extra
            .get("transportKind")
            .and_then(Value::as_str)
            .or_else(|| self.extra.get("transport_kind").and_then(Value::as_str))
            .and_then(|value| value.parse().ok())
            .unwrap_or_else(|| match self.provider {
                Some(ModelProvider::Anthropic) => ModelTransportKind::Anthropic,
                Some(ModelProvider::AmazonBedrock) => ModelTransportKind::Bedrock,
                Some(ModelProvider::Azure) => ModelTransportKind::OpenResponses,
                _ => ModelTransportKind::OpenAiCompatible,
            })
    }

    pub fn supports_image_input(&self) -> bool {
        if let Some(capabilities) = self.explicit_capabilities() {
            return capabilities
                .iter()
                .any(|capability| capability == "image" || capability == "imageInput");
        }

        match self.provider {
            Some(ModelProvider::Deepseek) => false,
            Some(ModelProvider::Moonshot) => false,
            Some(ModelProvider::KimiCode) => false,
            Some(ModelProvider::Xiaomi) => false,
            Some(ModelProvider::Siliconflow) => false,
            Some(ModelProvider::Xai)
            | Some(ModelProvider::ZAi)
            | Some(ModelProvider::ZhipuAi)
            | Some(ModelProvider::Minimax)
            | Some(ModelProvider::Alibaba)
            | Some(ModelProvider::Anthropic)
            | Some(ModelProvider::VercelAiGateway)
            | Some(ModelProvider::Openrouter)
            | Some(ModelProvider::FireworksAi)
            | Some(ModelProvider::Openai)
            | Some(ModelProvider::Google)
            | Some(ModelProvider::GoogleVertexAi)
            | Some(ModelProvider::Volcengine)
            | Some(ModelProvider::AmazonBedrock)
            | Some(ModelProvider::Azure)
            | Some(ModelProvider::Custom)
            | None => true,
        }
    }

    pub fn supports_image_generation(&self) -> bool {
        self.explicit_capabilities().is_some_and(|capabilities| {
            capabilities
                .iter()
                .any(|capability| capability == "imageGeneration")
        })
    }

    pub fn supports_video_generation(&self) -> bool {
        self.explicit_capabilities().is_some_and(|capabilities| {
            capabilities
                .iter()
                .any(|capability| capability == "videoGeneration")
        })
    }

    pub fn supports_chat(&self) -> bool {
        self.explicit_capabilities()
            .is_none_or(|capabilities| capabilities.iter().any(|capability| capability == "chat"))
    }

    pub fn explicit_capabilities(&self) -> Option<Vec<String>> {
        let raw = self.extra.get("capabilities")?.as_array()?;
        let capabilities = raw
            .iter()
            .filter_map(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
            .collect::<Vec<_>>();
        if capabilities.is_empty() {
            None
        } else {
            Some(capabilities)
        }
    }

    pub fn provider_site(&self) -> Option<String> {
        self.extra
            .get("providerSite")
            .or_else(|| self.extra.get("provider_site"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
    }

    pub fn alibaba_workspace_id(&self) -> Option<String> {
        self.extra
            .get("alibabaWorkspaceId")
            .or_else(|| self.extra.get("alibaba_workspace_id"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
    }

    pub fn alibaba_billing_mode(&self) -> Option<String> {
        self.extra
            .get("alibabaBillingMode")
            .or_else(|| self.extra.get("alibaba_billing_mode"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
    }

    pub fn aws_region(&self) -> Option<String> {
        self.extra
            .get("awsRegion")
            .or_else(|| self.extra.get("aws_region"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
    }

    pub fn vertex_project(&self) -> Option<String> {
        self.extra
            .get("vertexProject")
            .or_else(|| self.extra.get("vertex_project"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
    }

    pub fn vertex_location(&self) -> Option<String> {
        self.extra
            .get("vertexLocation")
            .or_else(|| self.extra.get("vertex_location"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
    }

    pub fn azure_resource_name(&self) -> Option<String> {
        self.extra
            .get("azureResourceName")
            .or_else(|| self.extra.get("azure_resource_name"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworksConfig {
    #[serde(rename = "llmHttpVersion", default = "default_llm_http_version")]
    pub llm_http_version: String,
}

fn default_llm_http_version() -> String {
    "http2".to_string()
}

impl Default for NetworksConfig {
    fn default() -> Self {
        Self {
            llm_http_version: default_llm_http_version(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(rename = "schemaVersion", alias = "schema_version", default = "default_schema_version")]
    pub schema_version: u64,
    #[serde(rename = "providerGroups", alias = "provider_groups", default)]
    pub provider_groups: Vec<ProviderGroup>,
    #[serde(rename = "activeModel", alias = "active_model")]
    pub active_model: ModelRef,
    #[serde(
        rename = "imageGenerationModel",
        alias = "image_generation_model",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub image_generation_model: Option<ModelRef>,
    #[serde(
        rename = "videoGenerationModel",
        alias = "video_generation_model",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub video_generation_model: Option<ModelRef>,
    #[serde(
        rename = "lightweightChatModel",
        alias = "lightweight_chat_model",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub lightweight_chat_model: Option<ModelRef>,
    #[serde(
        rename = "uiLocale",
        alias = "ui_locale",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub ui_locale: Option<String>,
    #[serde(default)]
    pub networks: NetworksConfig,
    #[serde(flatten, default, skip_serializing_if = "Map::is_empty")]
    pub extra: Map<String, Value>,
}

fn default_schema_version() -> u64 {
    SPIRIT_CONFIG_SCHEMA_VERSION
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            schema_version: SPIRIT_CONFIG_SCHEMA_VERSION,
            provider_groups: vec![],
            active_model: ModelRef::empty(),
            image_generation_model: None,
            video_generation_model: None,
            lightweight_chat_model: None,
            ui_locale: None,
            networks: NetworksConfig::default(),
            extra: Map::new(),
        }
    }
}

pub fn default_preset_provider_group_id(provider: ModelProvider) -> String {
    provider.as_str().to_string()
}

pub fn resolve_model_profile_from_parts(
    group: &ProviderGroup,
    model: &ModelEntry,
) -> Option<ModelProfile> {
    if group.id.trim().is_empty() || model.name.trim().is_empty() {
        return None;
    }

    let mut extra = Map::new();
    if let Some(transport_kind) = group.transport_kind.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
        extra.insert(
            "transportKind".to_string(),
            Value::String(transport_kind.to_string()),
        );
    }
    if let Some(site) = group.provider_site.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
        extra.insert("providerSite".to_string(), Value::String(site.to_string()));
    }
    if let Some(workspace_id) = group
        .alibaba_workspace_id
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
    {
        extra.insert(
            "alibabaWorkspaceId".to_string(),
            Value::String(workspace_id.to_string()),
        );
    }
    if let Some(billing_mode) = group
        .alibaba_billing_mode
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
    {
        extra.insert(
            "alibabaBillingMode".to_string(),
            Value::String(billing_mode.to_string()),
        );
    }
    if let Some(region) = group.aws_region.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
        extra.insert("awsRegion".to_string(), Value::String(region.to_string()));
    }
    if let Some(resource_name) = group
        .azure_resource_name
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
    {
        extra.insert(
            "azureResourceName".to_string(),
            Value::String(resource_name.to_string()),
        );
    }
    if let Some(account_id) = group
        .cloudflare_account_id
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
    {
        extra.insert(
            "cloudflareAccountId".to_string(),
            Value::String(account_id.to_string()),
        );
    }
    if let Some(gateway_id) = group
        .cloudflare_gateway_id
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
    {
        extra.insert(
            "cloudflareGatewayId".to_string(),
            Value::String(gateway_id.to_string()),
        );
    }
    if let Some(project) = group
        .vertex_project
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
    {
        extra.insert("vertexProject".to_string(), Value::String(project.to_string()));
    }
    if let Some(location) = group
        .vertex_location
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
    {
        extra.insert(
            "vertexLocation".to_string(),
            Value::String(location.to_string()),
        );
    }
    if let Some(capabilities) = model.capabilities.as_ref().filter(|caps| !caps.is_empty()) {
        extra.insert("capabilities".to_string(), Value::Array(
            capabilities.iter().map(|cap| Value::String(cap.clone())).collect(),
        ));
    }
    if let Some(efforts) = model
        .supported_reasoning_efforts
        .as_ref()
        .filter(|efforts| !efforts.is_empty())
    {
        extra.insert(
            "supportedReasoningEfforts".to_string(),
            Value::Array(
                efforts
                    .iter()
                    .map(|effort| Value::String(effort.clone()))
                    .collect(),
            ),
        );
    }
    if model.thinking_enabled == Some(false) {
        extra.insert("thinkingEnabled".to_string(), Value::Bool(false));
    }
    if let Some(thinking_type) = model
        .supports_thinking_type
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
    {
        extra.insert(
            "supportsThinkingType".to_string(),
            Value::String(thinking_type.to_string()),
        );
    }

    Some(ModelProfile {
        group_id: group.id.clone(),
        name: model.name.clone(),
        api_base: group.api_base.clone(),
        provider: Some(group.provider),
        reasoning_effort: model.reasoning_effort.clone(),
        context_length: model.context_length,
        extra,
    })
}

impl AppConfig {
    pub fn active_model_name(&self) -> &str {
        self.active_model.name.as_str()
    }

    pub fn find_provider_group(&self, group_id: &str) -> Option<&ProviderGroup> {
        let normalized = group_id.trim();
        if normalized.is_empty() {
            return None;
        }
        self.provider_groups.iter().find(|group| group.id == normalized)
    }

    pub fn find_provider_group_mut(&mut self, group_id: &str) -> Option<&mut ProviderGroup> {
        let normalized = group_id.trim();
        if normalized.is_empty() {
            return None;
        }
        self.provider_groups
            .iter_mut()
            .find(|group| group.id == normalized)
    }

    pub fn find_model_entry_in_group<'a>(
        group: &'a ProviderGroup,
        name: &str,
    ) -> Option<&'a ModelEntry> {
        let normalized = name.trim();
        if normalized.is_empty() {
            return None;
        }
        group.models.iter().find(|model| model.name == normalized)
    }

    pub fn find_model_entry_in_group_mut<'a>(
        group: &'a mut ProviderGroup,
        name: &str,
    ) -> Option<&'a mut ModelEntry> {
        let normalized = name.trim();
        if normalized.is_empty() {
            return None;
        }
        group.models.iter_mut().find(|model| model.name == normalized)
    }

    pub fn resolve_model_profile(&self, model_ref: &ModelRef) -> Option<ModelProfile> {
        if model_ref.is_empty() {
            return None;
        }
        let group = self.find_provider_group(&model_ref.group_id)?;
        let model = Self::find_model_entry_in_group(group, &model_ref.name)?;
        resolve_model_profile_from_parts(group, model)
    }

    pub fn flatten_models(&self) -> Vec<ModelProfile> {
        let mut resolved = Vec::new();
        for group in &self.provider_groups {
            for model in &group.models {
                if let Some(profile) = resolve_model_profile_from_parts(group, model) {
                    resolved.push(profile);
                }
            }
        }
        resolved
    }

    pub fn list_all_model_refs(&self) -> Vec<ModelRef> {
        let mut refs = Vec::new();
        for group in &self.provider_groups {
            for model in &group.models {
                refs.push(ModelRef {
                    group_id: group.id.clone(),
                    name: model.name.clone(),
                });
            }
        }
        refs
    }

    pub fn first_model_ref(&self) -> ModelRef {
        let Some(group) = self.provider_groups.first() else {
            return ModelRef::empty();
        };
        let Some(model) = group.models.first() else {
            return ModelRef::empty();
        };
        ModelRef {
            group_id: group.id.clone(),
            name: model.name.clone(),
        }
    }

    pub fn find_model_refs_by_name(&self, name: &str) -> Vec<ModelRef> {
        let normalized = name.trim();
        if normalized.is_empty() {
            return Vec::new();
        }
        let mut refs = Vec::new();
        for group in &self.provider_groups {
            for model in &group.models {
                if model.name == normalized {
                    refs.push(ModelRef {
                        group_id: group.id.clone(),
                        name: model.name.clone(),
                    });
                }
            }
        }
        refs
    }

    pub fn has_model_name(&self, name: &str) -> bool {
        !self.find_model_refs_by_name(name).is_empty()
    }

    pub fn parse_model_ref_selector(&self, selector: &str) -> Result<ModelRef, String> {
        let trimmed = selector.trim();
        if trimmed.is_empty() {
            return Err("模型标识不能为空".to_string());
        }
        if let Some((group_id, name)) = trimmed.split_once("::") {
            let group_id = group_id.trim();
            let name = name.trim();
            if group_id.is_empty() || name.is_empty() {
                return Err(format!("无效的模型标识: {}", trimmed));
            }
            let model_ref = ModelRef {
                group_id: group_id.to_string(),
                name: name.to_string(),
            };
            if !self.model_ref_exists(&model_ref) {
                return Err(format!("模型不存在: {}", trimmed));
            }
            return Ok(model_ref);
        }
        let matches = self.find_model_refs_by_name(trimmed);
        match matches.len() {
            0 => Err(format!("模型不存在，请先添加: {}", trimmed)),
            1 => Ok(matches[0].clone()),
            _ => {
                let examples = matches
                    .iter()
                    .take(3)
                    .map(model_ref_key)
                    .collect::<Vec<_>>()
                    .join(", ");
                Err(format!(
                    "存在多个同名模型，请使用 groupId::name 指定，例如: {}",
                    examples
                ))
            }
        }
    }

    pub fn find_model_ref_by_name(&self, name: &str) -> Option<ModelRef> {
        let matches = self.find_model_refs_by_name(name);
        if matches.len() == 1 {
            Some(matches[0].clone())
        } else {
            None
        }
    }

    pub fn has_model_in_group(&self, group_id: &str, name: &str) -> bool {
        let Some(group) = self.find_provider_group(group_id) else {
            return false;
        };
        Self::find_model_entry_in_group(group, name).is_some()
    }

    pub fn model_ref_exists(&self, model_ref: &ModelRef) -> bool {
        self.resolve_model_profile(model_ref).is_some()
    }

    pub fn active_model_profile(&self) -> Option<ModelProfile> {
        self.resolve_model_profile(&self.active_model)
    }

    pub fn active_provider_group_mut(&mut self) -> Option<&mut ProviderGroup> {
        let group_id = self.active_model.group_id.clone();
        self.find_provider_group_mut(&group_id)
    }

    pub fn active_model_entry_mut(&mut self) -> Option<&mut ModelEntry> {
        let group_id = self.active_model.group_id.clone();
        let name = self.active_model.name.clone();
        let group = self.find_provider_group_mut(&group_id)?;
        Self::find_model_entry_in_group_mut(group, &name)
    }

    pub fn image_generation_model_profile(&self) -> Option<ModelProfile> {
        let model_ref = self.image_generation_model.as_ref()?;
        self.resolve_model_profile(model_ref)
    }

    pub fn video_generation_model_profile(&self) -> Option<ModelProfile> {
        let model_ref = self.video_generation_model.as_ref()?;
        self.resolve_model_profile(model_ref)
    }

    pub fn lightweight_chat_model_profile(&self) -> Option<ModelProfile> {
        let model_ref = self.lightweight_chat_model.as_ref()?;
        self.resolve_model_profile(model_ref)
    }

    pub fn add_model_to_group(
        &mut self,
        group_id: &str,
        provider: ModelProvider,
        api_base: String,
        connect: ProviderGroupConnectDraft,
        entry: ModelEntry,
    ) {
        let normalized_group_id = group_id.trim().to_string();
        if let Some(group) = self.find_provider_group_mut(&normalized_group_id) {
            group.api_base = api_base;
            connect.apply_to_group(group);
            if !group.models.iter().any(|model| model.name == entry.name) {
                group.models.push(entry);
            }
            return;
        }

        let mut group = ProviderGroup {
            id: normalized_group_id,
            provider,
            label: None,
            api_base,
            transport_kind: None,
            provider_site: None,
            alibaba_workspace_id: None,
            alibaba_billing_mode: None,
            aws_region: None,
            azure_resource_name: None,
            cloudflare_account_id: None,
            cloudflare_gateway_id: None,
            vertex_project: None,
            vertex_location: None,
            models: vec![entry],
        };
        connect.apply_to_group(&mut group);
        self.provider_groups.push(group);
    }

    pub fn remove_model_by_name(&mut self, name: &str) -> bool {
        let normalized = name.trim();
        if normalized.is_empty() {
            return false;
        }
        let mut removed = false;
        for group in &mut self.provider_groups {
            let before = group.models.len();
            group.models.retain(|model| model.name != normalized);
            if group.models.len() != before {
                removed = true;
            }
        }
        self.provider_groups
            .retain(|group| !group.models.is_empty());
        removed
    }
}

#[derive(Debug, Clone, Default)]
pub struct ProviderGroupConnectDraft {
    pub transport_kind: Option<String>,
    pub provider_site: Option<String>,
    pub alibaba_workspace_id: Option<String>,
    pub alibaba_billing_mode: Option<String>,
    pub aws_region: Option<String>,
    pub azure_resource_name: Option<String>,
    pub cloudflare_account_id: Option<String>,
    pub cloudflare_gateway_id: Option<String>,
    pub vertex_project: Option<String>,
    pub vertex_location: Option<String>,
}

impl ProviderGroupConnectDraft {
    fn apply_to_group(&self, group: &mut ProviderGroup) {
        if let Some(value) = normalize_optional_string(self.transport_kind.clone()) {
            group.transport_kind = Some(value);
        }
        if let Some(value) = normalize_optional_string(self.provider_site.clone()) {
            group.provider_site = Some(value);
        }
        if let Some(value) = normalize_optional_string(self.alibaba_workspace_id.clone()) {
            group.alibaba_workspace_id = Some(value);
        }
        if let Some(value) = normalize_optional_string(self.alibaba_billing_mode.clone()) {
            group.alibaba_billing_mode = Some(value);
        }
        if let Some(value) = normalize_optional_string(self.aws_region.clone()) {
            group.aws_region = Some(value);
        }
        if let Some(value) = normalize_optional_string(self.azure_resource_name.clone()) {
            group.azure_resource_name = Some(value);
        }
        if let Some(value) = normalize_optional_string(self.cloudflare_account_id.clone()) {
            group.cloudflare_account_id = Some(value);
        }
        if let Some(value) = normalize_optional_string(self.cloudflare_gateway_id.clone()) {
            group.cloudflare_gateway_id = Some(value);
        }
        if let Some(value) = normalize_optional_string(self.vertex_project.clone()) {
            group.vertex_project = Some(value);
        }
        if let Some(value) = normalize_optional_string(self.vertex_location.clone()) {
            group.vertex_location = Some(value);
        }
    }
}

pub fn make_test_app_config_with_models(
    group_id: &str,
    provider: ModelProvider,
    api_base: &str,
    model_names: &[&str],
    active_name: &str,
) -> AppConfig {
    let mut cfg = AppConfig::default();
    for name in model_names {
        cfg.add_model_to_group(
            group_id,
            provider,
            api_base.to_string(),
            ProviderGroupConnectDraft::default(),
            ModelEntry {
                name: (*name).to_string(),
                reasoning_effort: None,
                thinking_enabled: None,
                supported_reasoning_efforts: None,
                capabilities: None,
                context_length: None,
                supports_thinking_type: None,
            },
        );
    }
    cfg.active_model = ModelRef {
        group_id: group_id.to_string(),
        name: active_name.to_string(),
    };
    cfg
}

pub fn config_file_path() -> PathBuf {
    spirit_agent_data_dir().join("config.json")
}

pub fn load_config() -> Result<AppConfig> {
    let path = config_file_path();
    if !Path::new(&path).exists() {
        let cfg = AppConfig::default();
        save_config(&cfg)?;
        return Ok(cfg);
    }

    let content =
        fs::read_to_string(&path).with_context(|| format!("读取配置失败: {}", path.display()))?;

    deserialize_config(&content, &path)
}

fn deserialize_config(content: &str, path: &Path) -> Result<AppConfig> {
    let raw: Value = serde_json::from_str(content)
        .with_context(|| format!("解析配置失败: {}", path.display()))?;

    let version = raw
        .get("schemaVersion")
        .or_else(|| raw.get("schema_version"))
        .and_then(Value::as_u64);
    if version != Some(SPIRIT_CONFIG_SCHEMA_VERSION) {
        return Err(anyhow::anyhow!(
            "config.json 须为 schemaVersion {}；请删除旧版配置后重新连接提供商。",
            SPIRIT_CONFIG_SCHEMA_VERSION
        ));
    }

    let mut cfg: AppConfig = serde_json::from_value(raw)
        .with_context(|| format!("解析配置失败: {}", path.display()))?;
    normalize_config(&mut cfg);
    Ok(cfg)
}

pub fn save_config(cfg: &AppConfig) -> Result<()> {
    let path = config_file_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("创建配置目录失败: {}", parent.display()))?;
    }

    let content = serialize_config(cfg)?;
    fs::write(&path, content).with_context(|| format!("写入配置失败: {}", path.display()))?;
    Ok(())
}

fn serialize_config(cfg: &AppConfig) -> Result<String> {
    Ok(serde_json::to_string_pretty(cfg)?)
}

fn normalize_config(cfg: &mut AppConfig) {
    cfg.schema_version = SPIRIT_CONFIG_SCHEMA_VERSION;
    cfg.networks.llm_http_version =
        crate::ports::normalize_llm_http_version(&cfg.networks.llm_http_version);

    if cfg.provider_groups.is_empty()
        || cfg
            .provider_groups
            .iter()
            .all(|group| group.models.is_empty())
    {
        cfg.active_model = ModelRef::empty();
        cfg.image_generation_model = None;
        cfg.video_generation_model = None;
        cfg.lightweight_chat_model = None;
        return;
    }

    if !cfg.model_ref_exists(&cfg.active_model) {
        cfg.active_model = cfg.first_model_ref();
    }

    let flattened = cfg.flatten_models();
    cfg.image_generation_model = normalize_slot_model_ref(
        cfg.image_generation_model.take(),
        &flattened,
        ModelProfile::supports_image_generation,
    );
    cfg.video_generation_model = normalize_slot_model_ref(
        cfg.video_generation_model.take(),
        &flattened,
        ModelProfile::supports_video_generation,
    );
    cfg.lightweight_chat_model = normalize_lightweight_chat_model_ref(
        cfg.lightweight_chat_model.take(),
        &flattened,
    );

    for group in &mut cfg.provider_groups {
        if group.api_base.trim().is_empty() {
            group.api_base = DEFAULT_API_BASE.to_string();
        }
        let provider = group.provider;
        let transport_kind = group
            .transport_kind
            .as_deref()
            .and_then(|value| value.parse().ok())
            .unwrap_or_else(|| match provider {
                ModelProvider::Anthropic => ModelTransportKind::Anthropic,
                ModelProvider::AmazonBedrock => ModelTransportKind::Bedrock,
                ModelProvider::Azure => ModelTransportKind::OpenResponses,
                _ => ModelTransportKind::OpenAiCompatible,
            });
        let normalized_transport = normalize_group_transport_kind(provider, transport_kind);
        group.transport_kind = match normalized_transport {
            ModelTransportKind::Anthropic
            | ModelTransportKind::OpenResponses
            | ModelTransportKind::Bedrock => Some(normalized_transport.as_str().to_string()),
            ModelTransportKind::OpenAiCompatible => None,
        };

        for model in &mut group.models {
            model.reasoning_effort = normalize_reasoning_effort_value(
                normalize_optional_string(model.reasoning_effort.take()),
                Some(provider),
                normalized_transport,
                &model.name,
            );
        }
    }
}

fn normalize_group_transport_kind(
    provider: ModelProvider,
    transport_kind: ModelTransportKind,
) -> ModelTransportKind {
    let mut transport_kind = transport_kind;
    if matches!(
        provider,
        ModelProvider::Google | ModelProvider::GoogleVertexAi
    ) && matches!(
        transport_kind,
        ModelTransportKind::OpenResponses | ModelTransportKind::Anthropic
    ) {
        transport_kind = ModelTransportKind::OpenAiCompatible;
    }
    if provider == ModelProvider::GoogleVertexAi && transport_kind == ModelTransportKind::Bedrock
    {
        transport_kind = ModelTransportKind::OpenAiCompatible;
    }
    transport_kind
}

fn normalize_slot_model_ref(
    value: Option<ModelRef>,
    models: &[ModelProfile],
    predicate: impl Fn(&ModelProfile) -> bool,
) -> Option<ModelRef> {
    let model_ref = value?;
    if model_ref.is_empty() {
        return None;
    }
    let profile = models
        .iter()
        .find(|model| model.group_id == model_ref.group_id && model.name == model_ref.name)?;
    if predicate(profile) {
        Some(model_ref)
    } else {
        None
    }
}

fn normalize_lightweight_chat_model_ref(
    value: Option<ModelRef>,
    models: &[ModelProfile],
) -> Option<ModelRef> {
    let model_ref = value?;
    if model_ref.is_empty() {
        return None;
    }
    let profile = models
        .iter()
        .find(|model| model.group_id == model_ref.group_id && model.name == model_ref.name)?;
    if profile.supports_chat() {
        Some(model_ref)
    } else {
        None
    }
}

pub(crate) fn normalize_reasoning_effort_value(
    value: Option<String>,
    provider: Option<ModelProvider>,
    transport_kind: ModelTransportKind,
    model_name: &str,
) -> Option<String> {
    let normalized = normalize_optional_string(value)?.to_ascii_lowercase();

    Some(match transport_kind {
        ModelTransportKind::Anthropic => match normalized.as_str() {
            "default" | "low" | "medium" | "high" | "xhigh" | "max" => normalized,
            "none" | "minimal" => "default".to_string(),
            _ => "default".to_string(),
        },
        ModelTransportKind::Bedrock
        | ModelTransportKind::OpenResponses
        | ModelTransportKind::OpenAiCompatible => match provider {
            Some(ModelProvider::Deepseek) if is_deepseek_v4_reasoning_model(model_name) => {
                match normalized.as_str() {
                    "default" | "high" | "max" => normalized,
                    "low" | "medium" => "high".to_string(),
                    "xhigh" => "max".to_string(),
                    "none" | "minimal" => "default".to_string(),
                    _ => "default".to_string(),
                }
            }
            Some(ModelProvider::Moonshot | ModelProvider::KimiCode) => match normalized.as_str() {
                "default" | "minimal" | "low" | "medium" | "high" => normalized,
                "none" => "default".to_string(),
                "xhigh" | "max" => "high".to_string(),
                _ => "default".to_string(),
            },
            Some(ModelProvider::Xai) => match normalized.as_str() {
                "default" | "none" | "low" | "medium" | "high" => normalized,
                "minimal" => "low".to_string(),
                "xhigh" | "max" => "high".to_string(),
                _ => "default".to_string(),
            },
            Some(ModelProvider::Google) | Some(ModelProvider::GoogleVertexAi) => {
                match normalized.as_str() {
                    "default" | "none" | "low" | "medium" | "high" => normalized,
                    "minimal" => "low".to_string(),
                    "xhigh" | "max" => "high".to_string(),
                    _ => "default".to_string(),
                }
            }
            _ => match normalized.as_str() {
                "default" | "none" | "low" | "medium" | "high" | "xhigh" => normalized,
                "minimal" => "default".to_string(),
                "max" => "xhigh".to_string(),
                _ => "medium".to_string(),
            },
        },
    })
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    let trimmed = value?.trim().to_string();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

fn is_deepseek_v4_reasoning_model(model: &str) -> bool {
    let normalized = model.trim().to_ascii_lowercase();
    normalized == "deepseek-v4-pro" || normalized == "deepseek-v4-flash"
}

#[cfg(test)]
mod tests {
    use super::{
        deserialize_config, normalize_reasoning_effort_value, serialize_config, AppConfig,
        ModelEntry, ModelProvider, ModelRef, ModelTransportKind,
        ProviderGroupConnectDraft, SPIRIT_CONFIG_SCHEMA_VERSION,
    };
    use serde_json::Value;
    use std::path::Path;

    fn test_profile(
        group_id: &str,
        name: &str,
        api_base: &str,
        provider: ModelProvider,
    ) -> super::ModelProfile {
        super::ModelProfile {
            group_id: group_id.to_string(),
            name: name.to_string(),
            api_base: api_base.to_string(),
            provider: Some(provider),
            reasoning_effort: None,
            context_length: None,
            extra: serde_json::Map::new(),
        }
    }

    #[test]
    fn rejects_non_v2_schema_version() {
        let config = r#"{"schemaVersion":1,"models":[],"activeModel":""}"#;
        let err = deserialize_config(config, Path::new("config.json")).unwrap_err();
        assert!(err
            .to_string()
            .contains(&format!("schemaVersion {SPIRIT_CONFIG_SCHEMA_VERSION}")));
    }

    #[test]
    fn normalize_reasoning_effort_preserves_moonshot_style_for_kimi_code() {
        assert_eq!(
            normalize_reasoning_effort_value(
                Some("minimal".to_string()),
                Some(ModelProvider::KimiCode),
                ModelTransportKind::OpenAiCompatible,
                "kimi-for-coding",
            ),
            Some("minimal".to_string()),
        );
        assert_eq!(
            normalize_reasoning_effort_value(
                Some("max".to_string()),
                Some(ModelProvider::KimiCode),
                ModelTransportKind::OpenAiCompatible,
                "kimi-for-coding",
            ),
            Some("high".to_string()),
        );
    }

    #[test]
    fn preserves_unknown_top_level_and_model_fields() {
        let config = r#"
{
  "schemaVersion": 2,
  "providerGroups": [
    {
      "id": "custom",
      "provider": "custom",
      "apiBase": "https://example.invalid/v1",
      "models": [
        {
          "name": "agent-test-model",
          "reasoningEffort": "minimal"
        }
      ]
    }
  ],
  "activeModel": { "groupId": "custom", "name": "agent-test-model" },
  "imageGenerationModel": { "groupId": "custom", "name": "agent-test-model" },
  "uiLocale": "zh-CN",
  "windowsMica": true,
  "recentWorkspaces": ["D:/SpiritAgent", "D:/Other"],
  "dreams": {
    "enabled": true,
    "collectorModel": "collector-test-model",
    "debugMode": true
  }
}
"#;

        let parsed = deserialize_config(config, Path::new("config.json")).expect("parse config");
        let serialized = serialize_config(&parsed).expect("serialize config");
        let json: Value = serde_json::from_str(&serialized).expect("json value");

        assert_eq!(json.get("windowsMica").and_then(Value::as_bool), Some(true));
        assert_eq!(
            json.get("recentWorkspaces")
                .and_then(Value::as_array)
                .map(|items| items.len()),
            Some(2)
        );
        assert_eq!(
            json.get("dreams")
                .and_then(|dreams| dreams.get("collectorModel"))
                .and_then(Value::as_str),
            Some("collector-test-model")
        );
        assert_eq!(
            json.get("providerGroups")
                .and_then(Value::as_array)
                .and_then(|groups| groups.first())
                .and_then(|group| group.get("models"))
                .and_then(Value::as_array)
                .and_then(|models| models.first())
                .and_then(|model| model.get("reasoningEffort"))
                .and_then(Value::as_str),
            Some("default")
        );
        assert_eq!(parsed.image_generation_model, None);
    }

    #[test]
    fn normalizing_empty_models_keeps_unknown_desktop_fields() {
        let config = r#"
{
  "schemaVersion": 2,
  "providerGroups": [],
  "activeModel": { "groupId": "", "name": "" },
  "windowsMica": false,
  "dreams": {
    "enabled": true,
    "debugMode": false
  }
}
"#;

        let parsed = deserialize_config(config, Path::new("config.json")).expect("parse config");
        let serialized = serialize_config(&parsed).expect("serialize config");
        let json: Value = serde_json::from_str(&serialized).expect("json value");

        assert_eq!(
            json.get("windowsMica").and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(
            json.get("dreams")
                .and_then(|dreams| dreams.get("enabled"))
                .and_then(Value::as_bool),
            Some(true)
        );
        assert_eq!(
            json.get("providerGroups")
                .and_then(Value::as_array)
                .map(Vec::len),
            Some(0)
        );
        assert_eq!(
            json.get("activeModel")
                .and_then(|active| active.get("name"))
                .and_then(Value::as_str),
            Some("")
        );
    }

    #[test]
    fn model_profile_supports_image_input_uses_explicit_capabilities_for_moonshot() {
        let kimi_without_capabilities =
            test_profile("moonshot-ai", "kimi-k2.6", "https://api.moonshot.cn/v1", ModelProvider::Moonshot);
        let mut kimi_with_image = kimi_without_capabilities.clone();
        kimi_with_image.extra.insert(
            "capabilities".to_string(),
            serde_json::json!(["chat", "image"]),
        );
        let deepseek = test_profile(
            "deepseek",
            "deepseek-v4-pro",
            "https://api.deepseek.com/v1",
            ModelProvider::Deepseek,
        );
        let custom = test_profile(
            "custom",
            "my-custom-model",
            "https://example.invalid/v1",
            ModelProvider::Custom,
        );

        assert!(!kimi_without_capabilities.supports_image_input());
        assert!(kimi_with_image.supports_image_input());
        assert!(!deepseek.supports_image_input());
        assert!(custom.supports_image_input());
    }

    #[test]
    fn model_profile_supports_image_input_uses_explicit_capabilities_for_xiaomi() {
        let mimo_without_capabilities = test_profile(
            "xiaomi",
            "mimo-v2-flash",
            "https://api.xiaomimimo.com/v1",
            ModelProvider::Xiaomi,
        );
        let mut mimo_with_image = mimo_without_capabilities.clone();
        mimo_with_image.extra.insert(
            "capabilities".to_string(),
            serde_json::json!(["chat", "image", "video"]),
        );

        assert!(!mimo_without_capabilities.supports_image_input());
        assert!(mimo_with_image.supports_image_input());
    }

    #[test]
    fn explicit_capabilities_override_provider_image_input_inference() {
        let mut deepseek = test_profile(
            "deepseek",
            "deepseek-v4-pro",
            "https://api.deepseek.com/v1",
            ModelProvider::Deepseek,
        );
        deepseek.extra.insert(
            "capabilities".to_string(),
            serde_json::json!(["chat", "image"]),
        );

        let mut custom = test_profile(
            "custom",
            "my-custom-model",
            "https://example.invalid/v1",
            ModelProvider::Custom,
        );
        custom
            .extra
            .insert("capabilities".to_string(), serde_json::json!(["chat"]));

        assert!(deepseek.supports_image_input());
        assert!(!custom.supports_image_input());
    }

    #[test]
    fn image_generation_model_requires_explicit_capability() {
        let config = r#"
{
    "schemaVersion": 2,
    "providerGroups": [
        {
            "id": "custom",
            "provider": "custom",
            "apiBase": "https://example.invalid/v1",
            "models": [
                { "name": "chat-model", "capabilities": ["chat"] },
                { "name": "image-model", "capabilities": ["imageGeneration"] }
            ]
        }
    ],
    "activeModel": { "groupId": "custom", "name": "chat-model" },
    "imageGenerationModel": { "groupId": "custom", "name": "image-model" }
}
"#;

        let parsed = deserialize_config(config, Path::new("config.json")).expect("parse config");
        assert_eq!(
            parsed.image_generation_model,
            Some(ModelRef {
                group_id: "custom".to_string(),
                name: "image-model".to_string(),
            })
        );

        let invalid = config.replace("image-model\"", "chat-model\"");
        let parsed = deserialize_config(&invalid, Path::new("config.json")).expect("parse config");
        assert_eq!(parsed.image_generation_model, None);
    }

    #[test]
    fn video_generation_model_requires_explicit_capability() {
        let config = r#"
{
    "schemaVersion": 2,
    "providerGroups": [
        {
            "id": "custom",
            "provider": "custom",
            "apiBase": "https://example.invalid/v1",
            "models": [
                { "name": "chat-model", "capabilities": ["chat"] },
                { "name": "video-model", "capabilities": ["videoGeneration"] }
            ]
        }
    ],
    "activeModel": { "groupId": "custom", "name": "chat-model" },
    "videoGenerationModel": { "groupId": "custom", "name": "video-model" }
}
"#;

        let parsed = deserialize_config(config, Path::new("config.json")).expect("parse config");
        assert_eq!(
            parsed.video_generation_model,
            Some(ModelRef {
                group_id: "custom".to_string(),
                name: "video-model".to_string(),
            })
        );

        let invalid = config.replace("video-model\"", "chat-model\"");
        let parsed = deserialize_config(&invalid, Path::new("config.json")).expect("parse config");
        assert_eq!(parsed.video_generation_model, None);
    }

    #[test]
    fn deserializes_alibaba_provider_from_desktop_config() {
        let config = r#"
{
    "schemaVersion": 2,
    "providerGroups": [
        {
            "id": "alibaba",
            "provider": "alibaba",
            "apiBase": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "models": [
                { "name": "qwen3.6-plus", "reasoningEffort": "medium" }
            ]
        }
    ],
    "activeModel": { "groupId": "alibaba", "name": "qwen3.6-plus" }
}
"#;

        let parsed = deserialize_config(config, Path::new("config.json")).expect("parse config");
        let active = parsed.active_model_profile().expect("active model");

        assert_eq!(active.provider, Some(ModelProvider::Alibaba));
        assert_eq!(active.reasoning_effort.as_deref(), Some("medium"));
    }

    #[test]
    fn deserializes_anthropic_transport_kind_from_desktop_config() {
        let config = r#"
{
    "schemaVersion": 2,
    "providerGroups": [
        {
            "id": "anthropic",
            "provider": "anthropic",
            "apiBase": "https://api.anthropic.com/v1",
            "transportKind": "anthropic",
            "models": [
                { "name": "claude-sonnet-4-5", "reasoningEffort": "high" }
            ]
        }
    ],
    "activeModel": { "groupId": "anthropic", "name": "claude-sonnet-4-5" }
}
"#;

        let parsed = deserialize_config(config, Path::new("config.json")).expect("parse config");
        let active = parsed.active_model_profile().expect("active model");

        assert_eq!(active.provider, Some(ModelProvider::Anthropic));
        assert_eq!(active.transport_kind(), ModelTransportKind::Anthropic);
        assert_eq!(active.reasoning_effort.as_deref(), Some("high"));
    }

    #[test]
    fn deserializes_vercel_ai_gateway_provider_from_desktop_config() {
        let config = r#"
{
    "schemaVersion": 2,
    "providerGroups": [
        {
            "id": "vercel-ai-gateway",
            "provider": "vercel-ai-gateway",
            "apiBase": "https://ai-gateway.vercel.sh/v1",
            "transportKind": "open-responses",
            "models": [
                { "name": "gateway-model", "reasoningEffort": "medium" }
            ]
        }
    ],
    "activeModel": { "groupId": "vercel-ai-gateway", "name": "gateway-model" }
}
"#;

        let parsed = deserialize_config(config, Path::new("config.json")).expect("parse config");
        let serialized = serialize_config(&parsed).expect("serialize config");
        let json: Value = serde_json::from_str(&serialized).expect("json value");
        let active = parsed.active_model_profile().expect("active model");

        assert_eq!(active.provider, Some(ModelProvider::VercelAiGateway));
        assert_eq!(
            json.get("providerGroups")
                .and_then(Value::as_array)
                .and_then(|groups| groups.first())
                .and_then(|group| group.get("provider"))
                .and_then(Value::as_str),
            Some("vercel-ai-gateway")
        );
    }

    #[test]
    fn normalizes_custom_openai_reasoning_effort_to_generic_values() {
        let config = r#"
{
    "schemaVersion": 2,
    "providerGroups": [
        {
            "id": "custom",
            "provider": "custom",
            "apiBase": "https://example.invalid/v1",
            "models": [
                { "name": "custom-openai-model", "reasoningEffort": "minimal" }
            ]
        }
    ],
    "activeModel": { "groupId": "custom", "name": "custom-openai-model" }
}
"#;

        let parsed = deserialize_config(config, Path::new("config.json")).expect("parse config");
        let active = parsed.active_model_profile().expect("active model");

        assert_eq!(active.reasoning_effort.as_deref(), Some("default"));
    }

    #[test]
    fn normalizes_custom_anthropic_reasoning_effort_to_anthropic_values() {
        let config = r#"
{
    "schemaVersion": 2,
    "providerGroups": [
        {
            "id": "custom",
            "provider": "custom",
            "apiBase": "https://api.anthropic.com/v1",
            "transportKind": "anthropic",
            "models": [
                { "name": "claude-custom", "reasoningEffort": "max" }
            ]
        }
    ],
    "activeModel": { "groupId": "custom", "name": "claude-custom" }
}
"#;

        let parsed = deserialize_config(config, Path::new("config.json")).expect("parse config");
        let active = parsed.active_model_profile().expect("active model");

        assert_eq!(active.transport_kind(), ModelTransportKind::Anthropic);
        assert_eq!(active.reasoning_effort.as_deref(), Some("max"));
    }

    #[test]
    fn roundtrips_model_context_length_field() {
        let config = r#"
{
  "schemaVersion": 2,
  "providerGroups": [
    {
      "id": "custom",
      "provider": "custom",
      "apiBase": "https://example.invalid/v1",
      "models": [
        { "name": "custom-model", "contextLength": 128000 }
      ]
    }
  ],
  "activeModel": { "groupId": "custom", "name": "custom-model" }
}
"#;

        let parsed = deserialize_config(config, Path::new("config.json")).expect("parse config");
        let active = parsed.active_model_profile().expect("active model");
        assert_eq!(active.context_length, Some(128_000));

        let serialized = serialize_config(&parsed).expect("serialize config");
        let json: Value = serde_json::from_str(&serialized).expect("json value");
        assert_eq!(
            json.get("providerGroups")
                .and_then(Value::as_array)
                .and_then(|groups| groups.first())
                .and_then(|group| group.get("models"))
                .and_then(Value::as_array)
                .and_then(|models| models.first())
                .and_then(|model| model.get("contextLength"))
                .and_then(Value::as_u64),
            Some(128_000)
        );

        let mut cfg = AppConfig::default();
        cfg.add_model_to_group(
            "custom",
            ModelProvider::Custom,
            "https://example.invalid/v1".to_string(),
            ProviderGroupConnectDraft::default(),
            ModelEntry {
                name: "plain".to_string(),
                reasoning_effort: None,
                thinking_enabled: None,
                supported_reasoning_efforts: None,
                capabilities: None,
                context_length: None,
                supports_thinking_type: None,
            },
        );
        let serialized_without = serialize_config(&cfg).expect("serialize config");
        let json_without: Value = serde_json::from_str(&serialized_without).expect("json value");
        assert_eq!(
            json_without
                .get("providerGroups")
                .and_then(Value::as_array)
                .and_then(|groups| groups.first())
                .and_then(|group| group.get("models"))
                .and_then(Value::as_array)
                .and_then(|models| models.first())
                .and_then(|model| model.get("contextLength")),
            None
        );
    }

    #[test]
    fn normalize_transport_kind_downgrades_google_open_responses() {
        let config = r#"
{
  "schemaVersion": 2,
  "providerGroups": [
    {
      "id": "google",
      "provider": "google",
      "apiBase": "https://generativelanguage.googleapis.com/v1beta",
      "transportKind": "open-responses",
      "models": [{ "name": "gemini-flash" }]
    }
  ],
  "activeModel": { "groupId": "google", "name": "gemini-flash" }
}
"#;
        let parsed = deserialize_config(config, Path::new("config.json")).expect("parse config");
        let active = parsed.active_model_profile().expect("active model");
        assert_eq!(active.transport_kind(), ModelTransportKind::OpenAiCompatible);
    }

    #[test]
    fn deserializes_siliconflow_provider_site_from_desktop_config() {
        let raw = r#"{
          "schemaVersion": 2,
          "providerGroups": [{
            "id": "siliconflow",
            "provider": "siliconflow",
            "apiBase": "https://api.siliconflow.cn/v1",
            "providerSite": "cn",
            "transportKind": "anthropic",
            "models": [{ "name": "deepseek-ai/DeepSeek-V3" }]
          }],
          "activeModel": { "groupId": "siliconflow", "name": "deepseek-ai/DeepSeek-V3" }
        }"#;
        let parsed = deserialize_config(raw, Path::new("config.json")).expect("parse config");
        let model = parsed.active_model_profile().expect("model");
        assert_eq!(model.provider, Some(ModelProvider::Siliconflow));
        assert_eq!(model.provider_site().as_deref(), Some("cn"));
        assert_eq!(model.transport_kind(), ModelTransportKind::Anthropic);
    }

    #[test]
    fn deserializes_moonshot_provider_site_from_desktop_config() {
        let raw = r#"{
          "schemaVersion": 2,
          "providerGroups": [{
            "id": "moonshot-ai",
            "provider": "moonshot-ai",
            "apiBase": "https://api.moonshot.ai/v1",
            "providerSite": "intl",
            "models": [{ "name": "kimi-k2" }]
          }],
          "activeModel": { "groupId": "moonshot-ai", "name": "kimi-k2" }
        }"#;
        let parsed = deserialize_config(raw, Path::new("config.json")).expect("parse config");
        let model = parsed.active_model_profile().expect("model");
        assert_eq!(model.provider, Some(ModelProvider::Moonshot));
        assert_eq!(model.provider_site().as_deref(), Some("intl"));
    }

    #[test]
    fn deserializes_minimax_provider_site_from_desktop_config() {
        let raw = r#"{
          "schemaVersion": 2,
          "providerGroups": [{
            "id": "minimax",
            "provider": "minimax",
            "apiBase": "https://api.minimax.io/anthropic/v1",
            "providerSite": "intl",
            "transportKind": "anthropic",
            "models": [{ "name": "MiniMax-M2.5" }]
          }],
          "activeModel": { "groupId": "minimax", "name": "MiniMax-M2.5" }
        }"#;
        let parsed = deserialize_config(raw, Path::new("config.json")).expect("parse config");
        let model = parsed.active_model_profile().expect("model");
        assert_eq!(model.provider, Some(ModelProvider::Minimax));
        assert_eq!(model.provider_site().as_deref(), Some("intl"));
        assert_eq!(model.transport_kind(), ModelTransportKind::Anthropic);
    }

    #[test]
    fn deserializes_alibaba_provider_site_and_workspace_from_desktop_config() {
        let raw = r#"{
          "schemaVersion": 2,
          "providerGroups": [{
            "id": "alibaba",
            "provider": "alibaba",
            "apiBase": "https://ws123.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
            "providerSite": "ap-southeast-1",
            "alibabaWorkspaceId": "ws123",
            "transportKind": "openai-compatible",
            "models": [{ "name": "qwen3.6-plus" }]
          }],
          "activeModel": { "groupId": "alibaba", "name": "qwen3.6-plus" }
        }"#;
        let parsed = deserialize_config(raw, Path::new("config.json")).expect("parse config");
        let model = parsed.active_model_profile().expect("model");
        assert_eq!(model.provider, Some(ModelProvider::Alibaba));
        assert_eq!(model.provider_site().as_deref(), Some("ap-southeast-1"));
        assert_eq!(model.alibaba_workspace_id().as_deref(), Some("ws123"));
    }

    #[test]
    fn deserializes_alibaba_token_plan_billing_mode_from_desktop_config() {
        let raw = r#"{
          "schemaVersion": 2,
          "providerGroups": [{
            "id": "alibaba",
            "provider": "alibaba",
            "apiBase": "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
            "alibabaBillingMode": "token-plan",
            "transportKind": "openai-compatible",
            "models": [{ "name": "qwen3.6-plus" }]
          }],
          "activeModel": { "groupId": "alibaba", "name": "qwen3.6-plus" }
        }"#;
        let parsed = deserialize_config(raw, Path::new("config.json")).expect("parse config");
        let model = parsed.active_model_profile().expect("model");
        assert_eq!(model.provider, Some(ModelProvider::Alibaba));
        assert_eq!(model.alibaba_billing_mode().as_deref(), Some("token-plan"));
        assert!(model.provider_site().is_none());
        assert!(model.alibaba_workspace_id().is_none());
    }

    #[test]
    fn active_model_profile_merges_group_and_model_entry() {
        let mut cfg = AppConfig::default();
        cfg.add_model_to_group(
            "openai",
            ModelProvider::Openai,
            "https://api.openai.com/v1".to_string(),
            ProviderGroupConnectDraft::default(),
            ModelEntry {
                name: "gpt-4o-mini".to_string(),
                reasoning_effort: Some("medium".to_string()),
                thinking_enabled: None,
                supported_reasoning_efforts: None,
                capabilities: Some(vec!["chat".to_string()]),
                context_length: None,
                supports_thinking_type: None,
            },
        );
        cfg.active_model = ModelRef {
            group_id: "openai".to_string(),
            name: "gpt-4o-mini".to_string(),
        };
        let active = cfg.active_model_profile().expect("active model");
        assert_eq!(active.group_id, "openai");
        assert_eq!(active.name, "gpt-4o-mini");
        assert_eq!(active.api_base, "https://api.openai.com/v1");
        assert_eq!(active.provider, Some(ModelProvider::Openai));
    }
}

pub fn keyring_entry() -> Result<keyring::Entry> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT_API_KEY).context("初始化 keyring 条目失败")
}

fn keyring_entry_for_account(account: &str) -> Result<keyring::Entry> {
    keyring::Entry::new(KEYRING_SERVICE, account)
        .with_context(|| format!("初始化 keyring 条目失败: {}", account))
}

fn model_key_account(model_name: &str) -> String {
    format!("model::{}", model_name)
}

fn group_key_account(group_id: &str) -> String {
    format!("group::{}", group_id)
}

fn group_access_key_id_account(group_id: &str) -> String {
    format!("group::{group_id}::access-key-id")
}

fn group_secret_access_key_account(group_id: &str) -> String {
    format!("group::{group_id}::secret-access-key")
}

fn group_vertex_client_email_account(group_id: &str) -> String {
    format!("group::{group_id}::client-email")
}

fn group_vertex_private_key_account(group_id: &str) -> String {
    format!("group::{group_id}::private-key")
}

pub fn load_group_api_key_from_keyring(group_id: &str) -> Result<String> {
    let entry = keyring_entry_for_account(&group_key_account(group_id))?;
    entry
        .get_password()
        .with_context(|| format!("读取 provider group {} 的 API Key 失败", group_id))
}

pub fn load_group_access_key_id_from_keyring(group_id: &str) -> Result<String> {
    let entry = keyring_entry_for_account(&group_access_key_id_account(group_id))?;
    entry.get_password().with_context(|| {
        format!("读取 provider group {group_id} 的 IAM Access Key ID 失败")
    })
}

pub fn load_group_secret_access_key_from_keyring(group_id: &str) -> Result<String> {
    let entry = keyring_entry_for_account(&group_secret_access_key_account(group_id))?;
    entry.get_password().with_context(|| {
        format!("读取 provider group {group_id} 的 IAM Secret Access Key 失败")
    })
}

pub fn has_bedrock_runtime_credentials_in_keyring(group_id: &str) -> Result<bool> {
    if load_group_api_key_from_keyring(group_id)
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
    {
        return Ok(true);
    }

    let access_key_id = load_group_access_key_id_from_keyring(group_id)
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);
    let secret_access_key = load_group_secret_access_key_from_keyring(group_id)
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);
    Ok(access_key_id && secret_access_key)
}

pub fn load_group_vertex_client_email_from_keyring(group_id: &str) -> Result<String> {
    let entry = keyring_entry_for_account(&group_vertex_client_email_account(group_id))?;
    entry.get_password().with_context(|| {
        format!("读取 provider group {group_id} 的 Vertex client email 失败")
    })
}

pub fn load_group_vertex_private_key_from_keyring(group_id: &str) -> Result<String> {
    let entry = keyring_entry_for_account(&group_vertex_private_key_account(group_id))?;
    entry.get_password().with_context(|| {
        format!("读取 provider group {group_id} 的 Vertex private key 失败")
    })
}

pub fn has_google_vertex_service_account_in_keyring(group_id: &str) -> Result<bool> {
    let client_email = load_group_vertex_client_email_from_keyring(group_id)
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);
    let private_key = load_group_vertex_private_key_from_keyring(group_id)
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);
    Ok(client_email && private_key)
}

pub fn has_google_vertex_runtime_credentials(
    api_key: &str,
    vertex_project: Option<&str>,
    vertex_location: Option<&str>,
    group_id: &str,
) -> bool {
    if !api_key.trim().is_empty() {
        return true;
    }
    let has_project_location = vertex_project.is_some_and(|value| !value.trim().is_empty())
        && vertex_location.is_some_and(|value| !value.trim().is_empty());
    if !has_project_location {
        return false;
    }
    if has_google_vertex_service_account_in_keyring(group_id).unwrap_or(false) {
        return true;
    }
    true
}

pub fn save_group_api_key(group_id: &str, api_key: &str) -> Result<()> {
    let entry = keyring_entry_for_account(&group_key_account(group_id))?;
    entry
        .set_password(api_key.trim())
        .with_context(|| format!("保存 provider group {group_id} 的 API Key 失败"))
}

pub fn save_group_vertex_credentials(
    group_id: &str,
    client_email: &str,
    private_key: &str,
) -> Result<()> {
    let client_email = client_email.trim();
    let private_key = private_key.trim();
    let email_entry = keyring_entry_for_account(&group_vertex_client_email_account(group_id))?;
    email_entry
        .set_password(client_email)
        .with_context(|| format!("保存 provider group {group_id} 的 Vertex client email 失败"))?;
    let key_entry = keyring_entry_for_account(&group_vertex_private_key_account(group_id))?;
    key_entry
        .set_password(private_key)
        .with_context(|| format!("保存 provider group {group_id} 的 Vertex private key 失败"))
}

pub fn save_model_api_key(model_name: &str, api_key: &str) -> Result<()> {
    let entry = keyring_entry_for_account(&model_key_account(model_name))?;
    entry
        .set_password(api_key.trim())
        .with_context(|| format!("保存模型 {} 的 API Key 失败", model_name))
}

pub fn remove_model_api_key(model_name: &str) -> Result<()> {
    let entry = keyring_entry_for_account(&model_key_account(model_name))?;
    match entry.delete_password() {
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(anyhow::anyhow!(
            "删除模型 {} 的 API Key 失败: {}",
            model_name,
            err
        )),
    }
}

pub fn has_model_api_key(model_name: &str) -> Result<bool> {
    let entry = keyring_entry_for_account(&model_key_account(model_name))?;
    match entry.get_password() {
        Ok(v) => Ok(!v.trim().is_empty()),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(err) => Err(anyhow::anyhow!(
            "读取模型 {} 的 API Key 失败: {}",
            model_name,
            err
        )),
    }
}

pub fn resolve_api_key_for_model(group_id: &str, model_name: &str) -> Result<String> {
    if let Ok(value) = env::var(ENV_API_KEY) {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return Ok(trimmed.to_string());
        }
    }

    if let Ok(value) = load_group_api_key_from_keyring(group_id) {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return Ok(trimmed.to_string());
        }
    }

    if let Ok(value) = load_model_api_key_from_keyring(model_name) {
        return Ok(value);
    }

    load_api_key_from_keyring()
}

fn load_api_key_from_keyring() -> Result<String> {
    let entry = keyring_entry()?;
    entry
        .get_password()
        .context("读取 keyring 中的 API Key 失败")
}

fn load_model_api_key_from_keyring(model_name: &str) -> Result<String> {
    let entry = keyring_entry_for_account(&model_key_account(model_name))?;
    entry
        .get_password()
        .with_context(|| format!("读取模型 {} 的 API Key 失败", model_name))
}
