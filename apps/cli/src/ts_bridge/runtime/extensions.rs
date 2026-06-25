use anyhow::Result;
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use serde_json::{json, Value};

use crate::ts_bridge::{
    types::{
        CliExtensionEntry, CliMarketplaceCatalogItem, CliMarketplaceDetail,
        CliMarketplacePreparedInstall,
    },
    TsBridgeRuntime,
};

impl TsBridgeRuntime {
    pub fn list_extensions(&mut self) -> Result<Vec<CliExtensionEntry>> {
        let value = self.call_bridge("hostInternal.listExtensions", None)?;
        Ok(serde_json::from_value(value)?)
    }

    pub fn import_extension_archive(
        &mut self,
        archive_bytes: &[u8],
        file_name: Option<&str>,
    ) -> Result<CliExtensionEntry> {
        let value = self.call_bridge(
            "hostInternal.importExtension",
            Some(json!({
                "archiveBase64": BASE64_STANDARD.encode(archive_bytes),
                "fileName": file_name,
            })),
        )?;
        Ok(serde_json::from_value(value)?)
    }

    pub fn delete_extension(&mut self, id: &str) -> Result<()> {
        self.call_bridge(
            "hostInternal.deleteExtension",
            Some(json!({
                "id": id,
            })),
        )?;
        Ok(())
    }

    pub fn list_marketplace_extensions(&mut self) -> Result<Vec<CliMarketplaceCatalogItem>> {
        let value = self.call_bridge("hostInternal.listMarketplaceExtensions", None)?;
        Ok(serde_json::from_value(value)?)
    }

    pub fn get_marketplace_extension_detail(
        &mut self,
        extension_id: &str,
    ) -> Result<CliMarketplaceDetail> {
        let value = self.call_bridge(
            "hostInternal.getMarketplaceExtensionDetail",
            Some(json!({
                "extensionId": extension_id,
            })),
        )?;
        Ok(serde_json::from_value(value)?)
    }

    pub fn get_marketplace_extension_readme(&mut self, extension_id: &str) -> Result<String> {
        let value = self.call_bridge(
            "hostInternal.getMarketplaceExtensionReadme",
            Some(json!({
                "extensionId": extension_id,
            })),
        )?;
        Ok(serde_json::from_value(value)?)
    }

    pub fn prepare_marketplace_extension_install(
        &mut self,
        extension_id: &str,
        version: Option<&str>,
    ) -> Result<CliMarketplacePreparedInstall> {
        let mut params = json!({
            "extensionId": extension_id,
        });
        if let Some(version) = version {
            if !version.trim().is_empty() {
                params["version"] = Value::String(version.trim().to_string());
            }
        }
        let value = self.call_bridge(
            "hostInternal.prepareMarketplaceExtensionInstall",
            Some(params),
        )?;
        Ok(serde_json::from_value(value)?)
    }

    pub fn install_marketplace_extension(
        &mut self,
        extension_id: &str,
        version: Option<&str>,
        review_acknowledged: bool,
    ) -> Result<CliExtensionEntry> {
        let mut params = json!({
            "extensionId": extension_id,
        });
        if let Some(version) = version {
            if !version.trim().is_empty() {
                params["version"] = Value::String(version.trim().to_string());
            }
        }
        if review_acknowledged {
            params["reviewAcknowledged"] = Value::Bool(true);
        }
        let value = self.call_bridge("hostInternal.installMarketplaceExtension", Some(params))?;
        Ok(serde_json::from_value(value)?)
    }
}
