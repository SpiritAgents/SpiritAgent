use super::*;
use crossterm::event::{self, Event, KeyCode, KeyEventKind, KeyModifiers};
use ratatui::{backend::Backend, widgets::Clear, Terminal};
use std::{io, time::Duration};

use crate::ts_bridge::{
    WorkspaceCapabilityTrustDecision, WorkspaceCapabilityTrustRequest,
};

impl TuiShell {
    /// Install the interactive trust prompter (if needed) and run deferred sessionStart.
    pub fn run_deferred_session_start<B: Backend + io::Write>(
        &mut self,
        terminal: &mut Terminal<B>,
    ) -> Result<()> {
        self.install_workspace_capability_trust_prompter(terminal);
        let source = if self.runtime.session().llm_history().is_empty() {
            "startup"
        } else {
            "resume"
        };
        self.runtime
            .run_session_start(source)
            .context("运行延迟 sessionStart 失败")?;
        Ok(())
    }

    fn install_workspace_capability_trust_prompter<B: Backend + io::Write>(
        &mut self,
        terminal: &mut Terminal<B>,
    ) {
        if self.runtime.has_workspace_capability_trust_prompter() {
            return;
        }

        // Field pointers stay valid for the TUI lifetime; nested host callbacks only touch
        // `forms` + `terminal`, never re-enter `runtime` through these pointers.
        let forms_ptr = std::ptr::addr_of_mut!(self.forms);
        let terminal_ptr = terminal as *mut Terminal<B>;

        self.runtime
            .set_workspace_capability_trust_prompter(Some(Box::new(move |request| {
                // SAFETY: `forms` is a distinct field from `runtime`; `terminal` is owned by
                // `run_app` for the whole interactive session.
                unsafe { prompt_workspace_capability_trust(forms_ptr, terminal_ptr, request) }
            })));
    }
}

unsafe fn prompt_workspace_capability_trust<B: Backend + io::Write>(
    forms_ptr: *mut BottomFormUiState,
    terminal_ptr: *mut Terminal<B>,
    request: WorkspaceCapabilityTrustRequest,
) -> WorkspaceCapabilityTrustDecision {
    let previous = (*forms_ptr).active.take();
    (*forms_ptr).active = Some(workspace_trust::new_form(&request));

    let decision = loop {
        let form_for_draw = (*forms_ptr).active.clone();
        if let Err(err) = (*terminal_ptr).draw(|frame| {
            let area = frame.area();
            frame.render_widget(Clear, area);
            if let Some(form) = form_for_draw.as_ref() {
                let height = area.height.saturating_mul(3) / 5;
                let height = height.max(8).min(area.height);
                let form_area = ratatui::layout::Rect {
                    x: area.x,
                    y: area.y.saturating_add(area.height.saturating_sub(height)),
                    width: area.width,
                    height,
                };
                crate::ui::draw_nested_bottom_form(frame, form_area, form);
            }
        }) {
            logging::log_event(&format!(
                "[workspace-trust] nested redraw failed: {err:#}; denying"
            ));
            break WorkspaceCapabilityTrustDecision::Deny;
        }

        let Ok(true) = event::poll(Duration::from_millis(100)) else {
            continue;
        };
        let Ok(evt) = event::read() else {
            continue;
        };
        let Event::Key(key) = evt else {
            continue;
        };
        if key.kind != KeyEventKind::Press {
            continue;
        }

        let Some(form) = (*forms_ptr).active.as_mut() else {
            break WorkspaceCapabilityTrustDecision::Deny;
        };

        match key.code {
            KeyCode::Up | KeyCode::Char('k') => workspace_trust::select_prev_row(form),
            KeyCode::Down | KeyCode::Char('j') => workspace_trust::select_next_row(form),
            KeyCode::Enter => {
                break workspace_trust::decision_for_selected_row(form);
            }
            KeyCode::Esc => break WorkspaceCapabilityTrustDecision::Deny,
            KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                break WorkspaceCapabilityTrustDecision::Deny;
            }
            _ => {}
        }
    };

    (*forms_ptr).active = previous;
    decision
}
