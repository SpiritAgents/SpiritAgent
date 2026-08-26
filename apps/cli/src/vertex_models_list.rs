//! Google Vertex AI publisher models listing via host-internal (Node).

use std::env;
use std::path::PathBuf;
use std::process::Command;

use serde::Deserialize;

#[derive(Debug, Clone)]
pub struct VertexListOptions {
    pub project: String,
    pub location: String,
    pub api_key: String,
    pub client_email: Option<String>,
    pub private_key: Option<String>,
}

#[derive(Debug, Deserialize)]
struct VertexListResponse {
    ids: Vec<String>,
}

pub fn vertex_api_base_from_project_and_location(project: &str, location: &str) -> String {
    let project = project.trim();
    let location = location.trim().to_ascii_lowercase();
    if project.is_empty() || location.is_empty() {
        return String::new();
    }
    let host = if location == "global" {
        "aiplatform.googleapis.com".to_string()
    } else {
        format!("{location}-aiplatform.googleapis.com")
    };
    format!("https://{host}/v1/projects/{project}/locations/{location}")
}

pub fn list_vertex_model_ids(options: VertexListOptions) -> Result<Vec<String>, String> {
    if !options.api_key.trim().is_empty() {
        return Err(
            "Google Vertex Express API Key mode cannot list models automatically; enter the model ID manually.".to_string(),
        );
    }

    let has_client_email = options
        .client_email
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty());
    let has_private_key = options
        .private_key
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty());
    if has_client_email ^ has_private_key {
        return Err(
            "Listing Google Vertex models with a service account requires both client email and private key.".to_string(),
        );
    }

    if options.project.trim().is_empty() || options.location.trim().is_empty() {
        return Err(
            "Listing Google Vertex models requires the GCP project ID and location.".to_string(),
        );
    }

    let module_path = resolve_host_internal_openai_models_path()?;
    let module_url = module_path
        .to_str()
        .ok_or_else(|| "Invalid host-internal module path".to_string())?
        .replace('\\', "/");
    let module_url = if module_url.starts_with('/') {
        format!("file://{module_url}")
    } else {
        format!("file:///{module_url}")
    };

    let payload = serde_json::json!({
        "provider": "google-vertex-ai",
        "baseUrl": vertex_api_base_from_project_and_location(&options.project, &options.location),
        "apiKey": options.api_key.trim(),
        "vertexProject": options.project.trim(),
        "vertexLocation": options.location.trim(),
        "vertexClientEmail": options.client_email.as_deref().unwrap_or("").trim(),
        "vertexPrivateKey": options.private_key.as_deref().unwrap_or("").trim(),
    });

    let script = format!(
        r#"
import {{ listGoogleVertexProviderModels }} from '{module_url}';
const options = JSON.parse(process.argv[1]);
const models = await listGoogleVertexProviderModels(options);
console.log(JSON.stringify({{ ids: models.map((entry) => entry.id) }}));
"#
    );

    let output = Command::new("node")
        .arg("--input-type=module")
        .arg("-e")
        .arg(script)
        .arg(payload.to_string())
        .output()
        .map_err(|err| format!("Failed to start the Node list models process: {err}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if !stderr.is_empty() { stderr } else { stdout };
        return Err(if detail.is_empty() {
            "Failed to list Google Vertex models.".to_string()
        } else {
            format!("Failed to list Google Vertex models: {detail}")
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let parsed: VertexListResponse = serde_json::from_str(stdout.trim())
        .map_err(|err| format!("Failed to parse the Vertex list models response: {err}"))?;
    Ok(parsed.ids)
}

fn resolve_host_internal_openai_models_path() -> Result<PathBuf, String> {
    if let Ok(path) = env::var("SPIRIT_HOST_INTERNAL_MODULE_PATH") {
        let candidate = PathBuf::from(&path);
        let openai_models = candidate
            .parent()
            .map(|parent| parent.join("openai-models.js"))
            .ok_or_else(|| "Invalid host-internal module path".to_string())?;
        if openai_models.exists() {
            return Ok(openai_models);
        }
        return Err(format!(
            "openai-models.js not found next to the SPIRIT_HOST_INTERNAL_MODULE_PATH environment variable: {}",
            openai_models.display()
        ));
    }

    let from_crate = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("packages")
        .join("host-internal")
        .join("dist")
        .join("openai-models.js");
    if from_crate.exists() {
        return Ok(from_crate);
    }

    Err(format!(
        "host-internal openai-models.js not found. Run pnpm run build in packages/host-internal first. Default lookup path: {}",
        from_crate.display()
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vertex_api_base_from_project_and_location_builds_managed_url() {
        assert_eq!(
            vertex_api_base_from_project_and_location("my-proj", "us-central1"),
            "https://us-central1-aiplatform.googleapis.com/v1/projects/my-proj/locations/us-central1"
        );
    }
}
