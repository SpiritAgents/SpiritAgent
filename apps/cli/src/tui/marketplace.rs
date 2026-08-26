use super::*;
use semver::Version;

#[derive(Debug, Default)]
pub(crate) struct MarketplaceState {
    pub(crate) catalog: Vec<CliMarketplaceCatalogItem>,
    pub(crate) detail_cache: HashMap<String, CliMarketplaceDetail>,
    pub(crate) readme_cache: HashMap<String, String>,
    pub(crate) open: bool,
    pub(crate) step_stack: Vec<MarketplaceFlowStep>,
    pub(crate) catalog_filter: String,
    pub(crate) detail_action_filter: String,
    pub(crate) version_filter: String,
    pub(crate) confirm_filter: String,
    pub(crate) catalog_selected_index: usize,
    pub(crate) detail_action_selected_index: usize,
    pub(crate) version_selected_index: usize,
    pub(crate) confirm_selected_index: usize,
    pub(crate) current_extension_id: Option<String>,
    pub(crate) error: Option<String>,
    pub(crate) readme_scroll: usize,
    pub(crate) install_guard: Option<(String, String)>,
}

impl MarketplaceState {
    pub(crate) fn close(&mut self) {
        self.open = false;
        self.step_stack.clear();
        self.current_extension_id = None;
        self.install_guard = None;
        self.error = None;
        self.readme_scroll = 0;
    }
}

impl TuiShell {
    pub fn refresh_marketplace_catalog(&mut self) -> Result<()> {
        self.marketplace.catalog = self
            .runtime
            .list_marketplace_extensions()
            .context(t!("tui.marketplace.catalog_read_failed").into_owned())?;
        logging::log_event(&format!(
            "[marketplace] catalog refreshed items={}",
            self.marketplace.catalog.len()
        ));
        self.marketplace.error = None;
        self.marketplace_sync_current_step_selection();
        Ok(())
    }

    pub fn marketplace_selected_catalog_item(&self) -> Option<&CliMarketplaceCatalogItem> {
        let index = self
            .marketplace_filtered_catalog_indices()
            .get(self.marketplace.catalog_selected_index)
            .copied()?;
        self.marketplace.catalog.get(index)
    }

    pub fn marketplace_current_step(&self) -> Option<MarketplaceFlowStep> {
        self.marketplace.step_stack.last().copied()
    }

    pub fn marketplace_filter_accepts_input(&self) -> bool {
        matches!(
            self.marketplace_current_step(),
            Some(MarketplaceFlowStep::CatalogPicker | MarketplaceFlowStep::VersionPicker)
        )
    }

    pub fn marketplace_move_selection_next(&mut self) {
        let len = self.marketplace_current_items_len();
        if len == 0 {
            return;
        }
        let selected = self.marketplace_selected_index_mut();
        *selected = (*selected + 1) % len;
        self.marketplace.install_guard = None;
    }

    pub fn marketplace_move_selection_prev(&mut self) {
        let len = self.marketplace_current_items_len();
        if len == 0 {
            return;
        }
        let selected = self.marketplace_selected_index_mut();
        *selected = if *selected == 0 {
            len - 1
        } else {
            *selected - 1
        };
        self.marketplace.install_guard = None;
    }

    pub fn marketplace_clear_filter(&mut self) {
        self.marketplace_current_filter_mut().clear();
        self.marketplace_sync_current_step_selection();
    }

    pub fn marketplace_insert_filter_char(&mut self, ch: char) {
        if ch == '\n' || ch == '\r' {
            return;
        }
        self.marketplace_current_filter_mut().push(ch);
        self.marketplace_sync_current_step_selection();
    }

    pub fn marketplace_insert_filter_text(&mut self, text: &str) {
        let filtered = text.chars().filter(|ch| *ch != '\n' && *ch != '\r');
        self.marketplace_current_filter_mut().extend(filtered);
        self.marketplace_sync_current_step_selection();
    }

    pub fn marketplace_backspace_filter(&mut self) {
        self.marketplace_current_filter_mut().pop();
        self.marketplace_sync_current_step_selection();
    }

    pub fn marketplace_refresh_selected_detail(&mut self) -> Result<()> {
        self.ensure_marketplace_selected_detail()
    }

    pub fn marketplace_submit_selection(&mut self) {
        match self.marketplace_current_step() {
            Some(MarketplaceFlowStep::CatalogPicker) => self.marketplace_open_selected_detail(),
            Some(MarketplaceFlowStep::DetailActions) => self.marketplace_open_version_picker(),
            Some(MarketplaceFlowStep::VersionPicker) => self.marketplace_prepare_selected_version(),
            Some(MarketplaceFlowStep::UnverifiedConfirm) => {
                self.marketplace_handle_install_confirmation()
            }
            None => {}
        }
    }

    pub fn marketplace_go_back(&mut self) {
        match self.marketplace_current_step() {
            Some(MarketplaceFlowStep::CatalogPicker) | None => self.close_marketplace_view(),
            Some(MarketplaceFlowStep::DetailActions) => {
                self.marketplace.step_stack.pop();
                self.marketplace.readme_scroll = 0;
            }
            Some(MarketplaceFlowStep::VersionPicker) => {
                self.marketplace.step_stack.pop();
                self.marketplace.version_filter.clear();
                self.marketplace.version_selected_index = 0;
            }
            Some(MarketplaceFlowStep::UnverifiedConfirm) => {
                self.marketplace.step_stack.pop();
                self.marketplace.confirm_filter.clear();
                self.marketplace.confirm_selected_index = 0;
            }
        }
        self.marketplace.error = None;
        self.marketplace_sync_current_step_selection();
    }

    pub fn marketplace_scroll_readme_up(&mut self, lines: usize) {
        self.marketplace.readme_scroll = self.marketplace.readme_scroll.saturating_sub(lines);
    }

    pub fn marketplace_scroll_readme_down(&mut self, lines: usize) {
        self.marketplace.readme_scroll = self.marketplace.readme_scroll.saturating_add(lines);
    }

    fn marketplace_current_items_len(&self) -> usize {
        match self.marketplace_current_step() {
            Some(MarketplaceFlowStep::CatalogPicker) => {
                self.marketplace_filtered_catalog_indices().len()
            }
            Some(MarketplaceFlowStep::DetailActions) => {
                self.marketplace_detail_action_items().len()
            }
            Some(MarketplaceFlowStep::VersionPicker) => self
                .marketplace_selected_detail()
                .map(|detail| self.marketplace_filtered_version_indices(detail).len())
                .unwrap_or(0),
            Some(MarketplaceFlowStep::UnverifiedConfirm) => {
                self.marketplace_confirmation_items().len()
            }
            None => 0,
        }
    }

    fn marketplace_selected_index_mut(&mut self) -> &mut usize {
        match self
            .marketplace_current_step()
            .unwrap_or(MarketplaceFlowStep::CatalogPicker)
        {
            MarketplaceFlowStep::CatalogPicker => &mut self.marketplace.catalog_selected_index,
            MarketplaceFlowStep::DetailActions => {
                &mut self.marketplace.detail_action_selected_index
            }
            MarketplaceFlowStep::VersionPicker => &mut self.marketplace.version_selected_index,
            MarketplaceFlowStep::UnverifiedConfirm => &mut self.marketplace.confirm_selected_index,
        }
    }

    fn marketplace_current_filter_mut(&mut self) -> &mut String {
        match self
            .marketplace_current_step()
            .unwrap_or(MarketplaceFlowStep::CatalogPicker)
        {
            MarketplaceFlowStep::CatalogPicker => &mut self.marketplace.catalog_filter,
            MarketplaceFlowStep::DetailActions => &mut self.marketplace.detail_action_filter,
            MarketplaceFlowStep::VersionPicker => &mut self.marketplace.version_filter,
            MarketplaceFlowStep::UnverifiedConfirm => &mut self.marketplace.confirm_filter,
        }
    }

    fn marketplace_current_filter(&self) -> &str {
        match self
            .marketplace_current_step()
            .unwrap_or(MarketplaceFlowStep::CatalogPicker)
        {
            MarketplaceFlowStep::CatalogPicker => &self.marketplace.catalog_filter,
            MarketplaceFlowStep::DetailActions => &self.marketplace.detail_action_filter,
            MarketplaceFlowStep::VersionPicker => &self.marketplace.version_filter,
            MarketplaceFlowStep::UnverifiedConfirm => &self.marketplace.confirm_filter,
        }
    }

    fn marketplace_sync_current_step_selection(&mut self) {
        match self.marketplace_current_step() {
            Some(MarketplaceFlowStep::CatalogPicker) => {
                let len = self.marketplace_filtered_catalog_indices().len();
                if len == 0 {
                    self.marketplace.catalog_selected_index = 0;
                } else if self.marketplace.catalog_selected_index >= len {
                    self.marketplace.catalog_selected_index = len - 1;
                }
            }
            Some(MarketplaceFlowStep::DetailActions) => {
                let len = self.marketplace_detail_action_items().len();
                if len == 0 {
                    self.marketplace.detail_action_selected_index = 0;
                } else if self.marketplace.detail_action_selected_index >= len {
                    self.marketplace.detail_action_selected_index = len - 1;
                }
            }
            Some(MarketplaceFlowStep::VersionPicker) => {
                if let Some(detail) = self.marketplace_selected_detail() {
                    let len = self.marketplace_filtered_version_indices(detail).len();
                    if len == 0 {
                        self.marketplace.version_selected_index = 0;
                    } else if self.marketplace.version_selected_index >= len {
                        self.marketplace.version_selected_index = len - 1;
                    }
                }
            }
            Some(MarketplaceFlowStep::UnverifiedConfirm) => {
                let len = self.marketplace_confirmation_items().len();
                if len == 0 {
                    self.marketplace.confirm_selected_index = 0;
                } else if self.marketplace.confirm_selected_index >= len {
                    self.marketplace.confirm_selected_index = len - 1;
                }
            }
            None => {}
        }
    }

    fn marketplace_detail_action_items(&self) -> Vec<String> {
        let query = self.marketplace.detail_action_filter.trim().to_lowercase();
        [t!("tui.marketplace.install_action").into_owned()]
            .into_iter()
            .filter(|item| query.is_empty() || item.to_lowercase().contains(&query))
            .collect()
    }

    fn marketplace_confirmation_items(&self) -> Vec<String> {
        let query = self.marketplace.confirm_filter.trim().to_lowercase();
        [
            t!("tui.marketplace.confirm_continue").into_owned(),
            t!("tui.marketplace.confirm_cancel").into_owned(),
        ]
        .into_iter()
        .filter(|item| query.is_empty() || item.to_lowercase().contains(&query))
        .collect()
    }

    fn marketplace_filtered_catalog_indices(&self) -> Vec<usize> {
        let query = self.marketplace.catalog_filter.trim().to_lowercase();
        self.marketplace
            .catalog
            .iter()
            .enumerate()
            .filter_map(|(index, item)| {
                if query.is_empty() {
                    return Some(index);
                }

                let haystack = format!(
                    "{} {} {} {} {} {}",
                    item.display_name,
                    item.description,
                    item.extension_id,
                    item.package_name,
                    item.author.as_deref().unwrap_or(""),
                    item.keywords.join(" "),
                );
                haystack.to_lowercase().contains(&query).then_some(index)
            })
            .collect()
    }

    fn marketplace_filtered_version_indices(&self, detail: &CliMarketplaceDetail) -> Vec<usize> {
        let query = self.marketplace.version_filter.trim().to_lowercase();
        let mut indices = (0..detail.versions.len()).collect::<Vec<_>>();
        indices.sort_by(|left, right| {
            Self::compare_marketplace_versions(
                detail.versions[*right].version.as_str(),
                detail.versions[*left].version.as_str(),
            )
        });
        indices
            .into_iter()
            .filter(|index| {
                if query.is_empty() {
                    return true;
                }
                let version = &detail.versions[*index];
                let haystack = format!(
                    "{} {} {} {} {}",
                    version.version,
                    version.channel,
                    version.review_status,
                    version.description,
                    version.supported_hosts.join(" "),
                );
                haystack.to_lowercase().contains(&query)
            })
            .collect()
    }

    pub(super) fn compare_marketplace_versions(left: &str, right: &str) -> std::cmp::Ordering {
        match (Version::parse(left), Version::parse(right)) {
            (Ok(left), Ok(right)) => return left.cmp_precedence(&right),
            (Ok(_), Err(_)) => return std::cmp::Ordering::Greater,
            (Err(_), Ok(_)) => return std::cmp::Ordering::Less,
            (Err(_), Err(_)) => {}
        }

        fn parse_loose(version: &str) -> Vec<u64> {
            version
                .split(['.', '-', '+'])
                .map(|part| part.parse::<u64>().unwrap_or(0))
                .collect()
        }

        let left_parts = parse_loose(left);
        let right_parts = parse_loose(right);
        let len = left_parts.len().max(right_parts.len());
        for index in 0..len {
            let left = *left_parts.get(index).unwrap_or(&0);
            let right = *right_parts.get(index).unwrap_or(&0);
            match left.cmp(&right) {
                std::cmp::Ordering::Equal => {}
                ordering => return ordering,
            }
        }
        left.cmp(right)
    }

    fn selected_marketplace_detail_id(&self) -> Option<String> {
        self.marketplace.current_extension_id.clone()
    }

    fn marketplace_selected_detail(&self) -> Option<&CliMarketplaceDetail> {
        let extension_id = self.selected_marketplace_detail_id()?;
        self.marketplace.detail_cache.get(&extension_id)
    }

    fn ensure_marketplace_selected_detail(&mut self) -> Result<()> {
        let Some(extension_id) = self.selected_marketplace_detail_id() else {
            self.marketplace.error = None;
            return Ok(());
        };

        if !self.marketplace.detail_cache.contains_key(&extension_id) {
            let detail = self
                .runtime
                .get_marketplace_extension_detail(&extension_id)
                .with_context(|| {
                    t!("tui.marketplace.detail_read_failed", id = extension_id).into_owned()
                })?;
            self.marketplace
                .detail_cache
                .insert(extension_id.clone(), detail);
        }

        if !self.marketplace.readme_cache.contains_key(&extension_id) {
            match self.runtime.get_marketplace_extension_readme(&extension_id) {
                Ok(readme) => {
                    self.marketplace
                        .readme_cache
                        .insert(extension_id.clone(), readme);
                }
                Err(err) => {
                    self.marketplace.error = Some(err.to_string());
                }
            }
        }

        self.marketplace_sync_current_step_selection();
        Ok(())
    }

    fn selected_marketplace_version<'a>(
        &self,
        detail: &'a CliMarketplaceDetail,
    ) -> Option<&'a CliMarketplaceDetailVersion> {
        let index = *self
            .marketplace_filtered_version_indices(detail)
            .get(self.marketplace.version_selected_index)?;
        detail.versions.get(index)
    }

    fn marketplace_selected_install_key(&self) -> Option<(String, String)> {
        let extension_id = self.selected_marketplace_detail_id()?;
        let detail = self.marketplace_selected_detail()?;
        let selected_version = self.selected_marketplace_version(detail)?.version.clone();
        Some((extension_id, selected_version))
    }

    fn prepare_selected_marketplace_install(&mut self) -> Option<CliMarketplacePreparedInstall> {
        let extension_id = self.selected_marketplace_detail_id()?;
        self.ensure_marketplace_selected_detail().ok()?;
        let selected_version = {
            let detail = self.marketplace_selected_detail()?;
            self.selected_marketplace_version(detail)?.version.clone()
        };
        self.runtime
            .prepare_marketplace_extension_install(&extension_id, Some(&selected_version))
            .inspect_err(|err| {
                self.marketplace.error = Some(err.to_string());
            })
            .ok()
    }

    fn install_prepared_marketplace_extension(
        &mut self,
        prepared: &CliMarketplacePreparedInstall,
        review_acknowledged: bool,
    ) -> Result<()> {
        let install_key = (prepared.extension_id.clone(), prepared.version.clone());
        if self
            .marketplace
            .install_guard
            .as_ref()
            .is_some_and(|current| current == &install_key)
        {
            self.marketplace.error = Some(
                t!(
                    "tui.marketplace.install_already_submitted",
                    id = prepared.extension_id,
                    version = prepared.version
                )
                .into_owned(),
            );
            self.messages.push(ChatMessage {
                role: MessageRole::Agent,
                content: t!(
                    "tui.marketplace.install_duplicate_ignored",
                    name = prepared.display_name,
                    version = prepared.version
                )
                .into_owned(),
                tool_block: None,
            });
            return Ok(());
        }

        self.marketplace.install_guard = Some(install_key);
        let installed = self.runtime.install_marketplace_extension(
            &prepared.extension_id,
            Some(&prepared.version),
            review_acknowledged,
        )?;
        self.refresh_extensions_from_disk()
            .context(t!("tui.marketplace.refresh_installed_failed").into_owned())?;
        self.marketplace.error = None;
        self.marketplace.confirm_filter.clear();
        self.marketplace.confirm_selected_index = 0;
        self.marketplace.version_filter.clear();
        self.marketplace.version_selected_index = 0;
        self.marketplace
            .step_stack
            .retain(|step| *step != MarketplaceFlowStep::UnverifiedConfirm);
        self.marketplace
            .step_stack
            .retain(|step| *step != MarketplaceFlowStep::VersionPicker);
        if self.marketplace.step_stack.last().copied() != Some(MarketplaceFlowStep::DetailActions) {
            self.marketplace
                .step_stack
                .push(MarketplaceFlowStep::DetailActions);
        }
        self.messages.push(ChatMessage {
            role: MessageRole::Agent,
            content: t!(
                "tui.marketplace.installed",
                name = installed.display_name,
                version = installed.version
            )
            .into_owned(),
            tool_block: None,
        });
        Ok(())
    }

    fn marketplace_open_selected_detail(&mut self) {
        let Some(extension_id) = self
            .marketplace_selected_catalog_item()
            .map(|item| item.extension_id.clone())
        else {
            return;
        };
        self.marketplace.current_extension_id = Some(extension_id);
        self.marketplace.readme_scroll = 0;
        if let Err(err) = self.ensure_marketplace_selected_detail() {
            self.marketplace.error = Some(err.to_string());
            return;
        }
        if self.marketplace.step_stack.last().copied() == Some(MarketplaceFlowStep::CatalogPicker) {
            self.marketplace
                .step_stack
                .push(MarketplaceFlowStep::DetailActions);
        }
        self.marketplace.detail_action_selected_index = 0;
        self.marketplace_sync_current_step_selection();
    }

    fn marketplace_open_version_picker(&mut self) {
        if self.marketplace_selected_detail().is_none() {
            self.marketplace.error = Some(t!("tui.marketplace.detail_not_loaded").into_owned());
            return;
        }
        if self.marketplace.step_stack.last().copied() != Some(MarketplaceFlowStep::VersionPicker) {
            self.marketplace
                .step_stack
                .push(MarketplaceFlowStep::VersionPicker);
        }
        self.marketplace.version_selected_index = 0;
        self.marketplace_sync_current_step_selection();
    }

    fn marketplace_prepare_selected_version(&mut self) {
        let Some(install_key) = self.marketplace_selected_install_key() else {
            return;
        };

        if self
            .marketplace
            .install_guard
            .as_ref()
            .is_some_and(|current| current == &install_key)
        {
            self.marketplace.error = Some(
                t!(
                    "tui.marketplace.install_already_submitted",
                    id = install_key.0,
                    version = install_key.1
                )
                .into_owned(),
            );
            return;
        }

        let Some(prepared) = self.prepare_selected_marketplace_install() else {
            return;
        };

        if !prepared.supports_current_host {
            self.marketplace.error = Some(
                t!(
                    "tui.marketplace.host_unsupported",
                    name = prepared.display_name,
                    version = prepared.version
                )
                .into_owned(),
            );
            return;
        }

        if prepared.review_status != "verified" {
            if self.marketplace.step_stack.last().copied()
                != Some(MarketplaceFlowStep::UnverifiedConfirm)
            {
                self.marketplace
                    .step_stack
                    .push(MarketplaceFlowStep::UnverifiedConfirm);
            }
            self.marketplace.confirm_selected_index = 0;
            self.marketplace.error = None;
            return;
        }

        if let Err(err) = self.install_prepared_marketplace_extension(&prepared, false) {
            self.marketplace.error = Some(err.to_string());
        }
    }

    fn marketplace_handle_install_confirmation(&mut self) {
        let choice = self
            .marketplace_confirmation_items()
            .get(self.marketplace.confirm_selected_index)
            .cloned();
        let continue_label = t!("tui.marketplace.confirm_continue").into_owned();
        let cancel_label = t!("tui.marketplace.confirm_cancel").into_owned();
        match choice {
            Some(item) if item == continue_label => {
                let Some(prepared) = self.prepare_selected_marketplace_install() else {
                    return;
                };
                if let Err(err) = self.install_prepared_marketplace_extension(&prepared, true) {
                    self.marketplace.error = Some(err.to_string());
                }
            }
            Some(item) if item == cancel_label => self.marketplace_go_back(),
            _ => {}
        }
    }

    pub(super) fn build_marketplace_view_model(&self) -> Option<MarketplaceViewModel> {
        if !self.marketplace.open {
            return None;
        }

        let installed_versions = self
            .extension_entries
            .iter()
            .flat_map(|entry| {
                let mut pairs = vec![(entry.id.clone(), entry.version.clone())];
                if let Some(package_name) = self
                    .marketplace
                    .catalog
                    .iter()
                    .find(|item| item.extension_id == entry.id)
                    .map(|item| item.package_name.clone())
                {
                    pairs.push((package_name, entry.version.clone()));
                }
                pairs
            })
            .collect::<HashMap<_, _>>();
        let filtered_indices = self.marketplace_filtered_catalog_indices();
        let catalog_items = filtered_indices
            .iter()
            .filter_map(|index| self.marketplace.catalog.get(*index))
            .map(|item| MarketplaceCatalogItemView {
                extension_id: item.extension_id.clone(),
                package_name: item.package_name.clone(),
                display_name: item.display_name.clone(),
                description: item.description.clone(),
                author: item.author.clone(),
                featured: item.featured,
                default_version: item.default_version.clone(),
                default_channel: item.default_channel.clone(),
                default_review_status: item.default_review_status.clone(),
                supported_hosts: item.supported_hosts.clone(),
                requested_capabilities: item.requested_capabilities.clone(),
                icon_url: item.icon_url.clone(),
                installed_version: installed_versions
                    .get(&item.package_name)
                    .or_else(|| installed_versions.get(&item.extension_id))
                    .cloned(),
            })
            .collect::<Vec<_>>();

        let selected_item = self
            .selected_marketplace_detail_id()
            .and_then(|selected_id| {
                self.marketplace
                    .catalog
                    .iter()
                    .find(|item| item.extension_id == selected_id)
                    .map(|item| MarketplaceCatalogItemView {
                        extension_id: item.extension_id.clone(),
                        package_name: item.package_name.clone(),
                        display_name: item.display_name.clone(),
                        description: item.description.clone(),
                        author: item.author.clone(),
                        featured: item.featured,
                        default_version: item.default_version.clone(),
                        default_channel: item.default_channel.clone(),
                        default_review_status: item.default_review_status.clone(),
                        supported_hosts: item.supported_hosts.clone(),
                        requested_capabilities: item.requested_capabilities.clone(),
                        icon_url: item.icon_url.clone(),
                        installed_version: installed_versions
                            .get(&item.package_name)
                            .or_else(|| installed_versions.get(&item.extension_id))
                            .cloned(),
                    })
            })
            .or_else(|| {
                catalog_items
                    .get(self.marketplace.catalog_selected_index)
                    .cloned()
            });

        let detail = self.marketplace_selected_detail().map(|detail| {
            let selected_id = self.selected_marketplace_detail_id().unwrap_or_default();
            MarketplaceDetailView {
                package_name: detail.package_name.clone(),
                status: detail.status.clone(),
                featured: detail.featured,
                default_version: detail.default_version.clone(),
                readme: self.marketplace.readme_cache.get(&selected_id).cloned(),
                versions: detail
                    .versions
                    .iter()
                    .map(Self::marketplace_version_view)
                    .collect(),
            }
        });

        let slash = self.build_marketplace_slash_view(
            &catalog_items,
            selected_item.as_ref(),
            detail.as_ref(),
        );

        Some(MarketplaceViewModel {
            step: self
                .marketplace_current_step()
                .unwrap_or(MarketplaceFlowStep::CatalogPicker),
            query: self.marketplace_current_filter().to_string(),
            error: self.marketplace.error.clone(),
            catalog_items,
            selected_item,
            detail,
            slash,
            readme_scroll: self.marketplace.readme_scroll,
        })
    }

    fn marketplace_version_view(version: &CliMarketplaceDetailVersion) -> MarketplaceVersionView {
        MarketplaceVersionView {
            version: version.version.clone(),
            channel: version.channel.clone(),
            review_status: version.review_status.clone(),
            display_name: version.display_name.clone(),
            description: version.description.clone(),
            author: version.author.clone(),
            homepage_url: version.homepage_url.clone(),
            repository_url: version.repository_url.clone(),
            keywords: version.keywords.clone(),
            supported_hosts: version.supported_hosts.clone(),
            requested_capabilities: version.requested_capabilities.clone(),
            icon_url: version.icon_url.clone(),
            published_at: version.published_at.clone(),
            tarball_url: version.tarball_url.clone(),
            changelog: version.changelog.as_ref().map(|changelog| {
                MarketplaceVersionChangelogView {
                    summary: changelog.summary.clone(),
                    body: changelog.body.clone(),
                }
            }),
        }
    }

    fn build_marketplace_slash_view(
        &self,
        catalog_items: &[MarketplaceCatalogItemView],
        selected_item: Option<&MarketplaceCatalogItemView>,
        detail: Option<&MarketplaceDetailView>,
    ) -> SlashFlowView {
        match self
            .marketplace_current_step()
            .unwrap_or(MarketplaceFlowStep::CatalogPicker)
        {
            MarketplaceFlowStep::CatalogPicker => SlashFlowView {
                title: t!("tui.marketplace.extensions_title").into_owned(),
                subtitle: None,
                search: Some(crate::view::SlashFlowSearchView {
                    value: self.marketplace.catalog_filter.clone(),
                    placeholder: t!("tui.marketplace.search_placeholder").into_owned(),
                }),
                empty_text: t!("tui.marketplace.no_matching_extensions").into_owned(),
                selected_index: self
                    .marketplace
                    .catalog_selected_index
                    .min(catalog_items.len().saturating_sub(1)),
                items: catalog_items
                    .iter()
                    .map(|item| SlashFlowItemView {
                        label: item.display_name.clone(),
                        summary: item.description.clone(),
                        details: Vec::new(),
                        disabled: false,
                        muted: false,
                    })
                    .collect(),
                compact_items: true,
                footer_hint: t!("tui.marketplace.extensions_footer").into_owned(),
            },
            MarketplaceFlowStep::DetailActions => SlashFlowView {
                title: t!("tui.marketplace.actions_title").into_owned(),
                subtitle: None,
                search: None,
                empty_text: t!("tui.marketplace.no_matching_actions").into_owned(),
                selected_index: self.marketplace.detail_action_selected_index,
                items: self
                    .marketplace_detail_action_items()
                    .into_iter()
                    .map(|item| SlashFlowItemView {
                        label: item.to_string(),
                        summary: String::new(),
                        details: Vec::new(),
                        disabled: detail.is_none(),
                        muted: false,
                    })
                    .collect(),
                compact_items: false,
                footer_hint: t!("tui.marketplace.actions_footer").into_owned(),
            },
            MarketplaceFlowStep::VersionPicker => {
                let items = detail
                    .map(|detail| {
                        let selected_version = selected_item
                            .and_then(|item| item.installed_version.as_deref())
                            .map(str::to_string);
                        self.marketplace_filtered_version_indices(
                            self.marketplace_selected_detail()
                                .expect("detail should exist"),
                        )
                        .into_iter()
                        .filter_map(|index| detail.versions.get(index))
                        .map(|version| {
                            let supported =
                                version.supported_hosts.iter().any(|host| host == "cli");
                            let installed = selected_version
                                .as_ref()
                                .is_some_and(|installed| installed == &version.version);
                            SlashFlowItemView {
                                label: version.version.clone(),
                                summary: format!(
                                    "{}  ·  {}",
                                    Self::marketplace_channel_text(&version.channel),
                                    Self::marketplace_review_text(&version.review_status)
                                ),
                                details: vec![if installed {
                                    t!("tui.marketplace.badge_installed").into_owned()
                                } else if supported {
                                    t!("tui.marketplace.badge_cli_supported").into_owned()
                                } else {
                                    t!("tui.marketplace.badge_cli_unsupported").into_owned()
                                }],
                                disabled: !supported,
                                muted: !supported,
                            }
                        })
                        .collect::<Vec<_>>()
                    })
                    .unwrap_or_default();
                SlashFlowView {
                    title: t!("tui.marketplace.versions_title").into_owned(),
                    subtitle: None,
                    search: Some(crate::view::SlashFlowSearchView {
                        value: self.marketplace.version_filter.clone(),
                        placeholder: t!("tui.marketplace.version_placeholder").into_owned(),
                    }),
                    empty_text: t!("tui.marketplace.no_matching_versions").into_owned(),
                    selected_index: self
                        .marketplace
                        .version_selected_index
                        .min(items.len().saturating_sub(1)),
                    items,
                    compact_items: false,
                    footer_hint: t!("tui.marketplace.versions_footer").into_owned(),
                }
            }
            MarketplaceFlowStep::UnverifiedConfirm => SlashFlowView {
                title: t!("tui.marketplace.confirm_title").into_owned(),
                subtitle: None,
                search: None,
                empty_text: t!("tui.marketplace.no_matching_options").into_owned(),
                selected_index: self.marketplace.confirm_selected_index.min(
                    self.marketplace_confirmation_items()
                        .len()
                        .saturating_sub(1),
                ),
                items: {
                    let continue_label = t!("tui.marketplace.confirm_continue").into_owned();
                    let cancel_label = t!("tui.marketplace.confirm_cancel").into_owned();
                    self.marketplace_confirmation_items()
                        .into_iter()
                        .map(|item| SlashFlowItemView {
                            summary: if item == continue_label {
                                t!("tui.marketplace.confirm_ack_unverified").into_owned()
                            } else {
                                t!("tui.marketplace.confirm_back_to_versions").into_owned()
                            },
                            muted: item == cancel_label,
                            label: item,
                            details: Vec::new(),
                            disabled: false,
                        })
                        .collect()
                },
                compact_items: false,
                footer_hint: t!("tui.marketplace.confirm_footer").into_owned(),
            },
        }
    }

    fn marketplace_review_text(status: &str) -> String {
        match status.trim() {
            "verified" => t!("tui.marketplace.status_verified").into_owned(),
            "revoked" => t!("tui.marketplace.status_revoked").into_owned(),
            _ => t!("tui.marketplace.status_unverified").into_owned(),
        }
    }

    fn marketplace_channel_text(channel: &str) -> String {
        match channel.trim() {
            "stable" => t!("tui.marketplace.channel_stable").into_owned(),
            "preview" => t!("tui.marketplace.channel_preview").into_owned(),
            "experimental" => t!("tui.marketplace.channel_experimental").into_owned(),
            other => other.to_string(),
        }
    }

    pub fn open_marketplace_view(&mut self, query: Option<&str>) {
        self.forms.active = None;
        self.model_picker_active = false;
        self.language_picker_active = false;
        self.approval_picker_active = false;
        self.network_picker_active = false;
        self.tui_picker_active = false;
        self.chat_picker_active = false;
        self.subagent.picker_active = false;
        self.close_subagent_view();
        self.image_picker_active = false;
        self.marketplace.open = true;
        self.marketplace.step_stack = vec![MarketplaceFlowStep::CatalogPicker];
        self.marketplace.catalog_filter = query.unwrap_or("").trim().to_string();
        self.marketplace.detail_action_filter.clear();
        self.marketplace.version_filter.clear();
        self.marketplace.confirm_filter.clear();
        self.marketplace.catalog_selected_index = 0;
        self.marketplace.detail_action_selected_index = 0;
        self.marketplace.version_selected_index = 0;
        self.marketplace.confirm_selected_index = 0;
        self.marketplace.current_extension_id = None;
        self.marketplace.error = None;
        self.marketplace.readme_scroll = 0;
        self.marketplace.install_guard = None;

        if let Err(err) = self.refresh_marketplace_catalog() {
            self.marketplace.error = Some(err.to_string());
            self.messages.push(ChatMessage {
                role: MessageRole::Agent,
                content: t!("tui.marketplace.read_failed", err = err).into_owned(),
                tool_block: None,
            });
            return;
        }

        self.marketplace_sync_current_step_selection();
        self.set_input(String::new());
        self.refresh_suggestions();
    }

    pub fn close_marketplace_view(&mut self) {
        self.marketplace.close();
    }

    pub fn is_marketplace_view_active(&self) -> bool {
        self.marketplace.open
    }

    pub fn marketplace_step(&self) -> Option<MarketplaceFlowStep> {
        self.marketplace_current_step()
    }
}
