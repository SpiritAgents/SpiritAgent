use serde::Deserialize;

/// One matched permission rule (config.json pattern plus its action).
#[derive(Debug, Deserialize)]
pub struct PermissionRuleMatch {
    pub pattern: String,
    pub action: String,
}

/// Shell-only per-simple-command detail from `host.checkPermission`.
#[derive(Debug, Deserialize)]
pub struct PermissionCheckSegment {
    pub segment: String,
    pub verdict: String,
    pub matched: Option<PermissionRuleMatch>,
}

/// `host.checkPermission` result (mirrors the daemon's `HostCheckPermissionResult`).
#[derive(Debug, Deserialize)]
pub struct PermissionCheckResult {
    pub verdict: String,
    pub matched: Option<PermissionRuleMatch>,
    pub segments: Option<Vec<PermissionCheckSegment>>,
    #[serde(default)]
    pub warnings: Vec<String>,
}
