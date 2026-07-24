use rust_i18n::t;

use crate::{
    ts_bridge::{
        WorkspaceCapabilityTrustDecision, WorkspaceCapabilityTrustHookEntry,
        WorkspaceCapabilityTrustRequest,
    },
    view::{
        BottomFormFieldEditorView, BottomFormFieldView, BottomFormKind, BottomFormView,
        WorkspaceCapabilityTrustHookView,
    },
};

pub(crate) const OPTION_COUNT: usize = 3;

pub(crate) fn new_form(request: &WorkspaceCapabilityTrustRequest) -> BottomFormView {
    let mut fields = vec![BottomFormFieldView {
        label: String::new(),
        help: String::new(),
        editor: BottomFormFieldEditorView::Section {
            text: t!("form.workspace_trust.risk").into_owned(),
        },
    }];

    if request.hash_changed {
        fields.push(BottomFormFieldView {
            label: String::new(),
            help: String::new(),
            editor: BottomFormFieldEditorView::Section {
                text: t!("form.workspace_trust.hooks_changed").into_owned(),
            },
        });
    }

    fields.push(BottomFormFieldView {
        label: String::new(),
        help: String::new(),
        editor: BottomFormFieldEditorView::Section {
            text: t!("form.workspace_trust.hooks_heading").into_owned(),
        },
    });

    for hook in &request.hooks {
        fields.push(BottomFormFieldView {
            label: hook.event.clone(),
            help: String::new(),
            editor: BottomFormFieldEditorView::Section {
                text: format_hook_line(hook),
            },
        });
    }

    BottomFormView {
        kind: BottomFormKind::WorkspaceCapabilityTrust {
            hash_changed: request.hash_changed,
            hooks: request
                .hooks
                .iter()
                .map(|hook| WorkspaceCapabilityTrustHookView {
                    event: hook.event.clone(),
                    command: hook.command.clone(),
                    resolved_path: hook.resolved_path.clone(),
                })
                .collect(),
            selected_row: 0,
        },
        title: t!("form.workspace_trust.title").into_owned(),
        fields,
        selected_field: 0,
        scroll_offset: 0,
        footer_hint: t!("form.workspace_trust.footer_hint").into_owned(),
    }
}

pub(crate) fn select_next_row(form: &mut BottomFormView) {
    let Some(selected_row) = selected_row_mut(form) else {
        return;
    };
    *selected_row = (*selected_row + 1) % OPTION_COUNT;
}

pub(crate) fn select_prev_row(form: &mut BottomFormView) {
    let Some(selected_row) = selected_row_mut(form) else {
        return;
    };
    *selected_row = if *selected_row == 0 {
        OPTION_COUNT - 1
    } else {
        *selected_row - 1
    };
}

pub(crate) fn selected_row(form: &BottomFormView) -> usize {
    match &form.kind {
        BottomFormKind::WorkspaceCapabilityTrust { selected_row, .. } => {
            (*selected_row).min(OPTION_COUNT - 1)
        }
        _ => 0,
    }
}

pub(crate) fn decision_for_selected_row(form: &BottomFormView) -> WorkspaceCapabilityTrustDecision {
    match selected_row(form) {
        0 => WorkspaceCapabilityTrustDecision::AllowOnce,
        2 => WorkspaceCapabilityTrustDecision::AlwaysTrust,
        _ => WorkspaceCapabilityTrustDecision::Deny,
    }
}

pub(crate) fn option_label(index: usize) -> String {
    match index {
        0 => t!("form.workspace_trust.allow_once").into_owned(),
        1 => t!("form.workspace_trust.deny").into_owned(),
        _ => t!("form.workspace_trust.always_trust").into_owned(),
    }
}

fn selected_row_mut(form: &mut BottomFormView) -> Option<&mut usize> {
    match &mut form.kind {
        BottomFormKind::WorkspaceCapabilityTrust { selected_row, .. } => Some(selected_row),
        _ => None,
    }
}

fn format_hook_line(hook: &WorkspaceCapabilityTrustHookEntry) -> String {
    if hook.resolved_path.trim().is_empty()
        || hook.resolved_path == hook.command
    {
        hook.command.clone()
    } else {
        format!("{}  ({})", hook.command, hook.resolved_path)
    }
}
