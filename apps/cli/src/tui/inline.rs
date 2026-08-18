use super::*;
use anyhow::anyhow;
use crossterm::{
    cursor::{Hide, MoveTo},
    execute,
    style::Print,
    terminal::{Clear, ClearType as CrosstermClearType},
};
use ratatui::{
    Terminal, TerminalOptions, Viewport,
    backend::{Backend, ClearType, CrosstermBackend, WindowSize},
    buffer::{Buffer, Cell},
    layout::{Position, Size},
    text::Line,
    widgets::{Paragraph, Widget},
};
use std::io;
use unicode_width::UnicodeWidthStr;

/// Start with a 1-line inline viewport (`append_lines(0)`); during load the cursor stays on the
/// line below the command. The first frame grows to the real layout height via
/// `inline_needed_viewport_height`.
pub const INLINE_BOOTSTRAP_HEIGHT: u16 = 1;

/// Wraps Crossterm so rebuilding the viewport at the original y can disable `append_lines`,
/// avoiding extra blank lines that would push the UI away.
pub struct InlineBackend {
    inner: CrosstermBackend<io::Stdout>,
    suppress_append_lines: bool,
}

impl InlineBackend {
    pub fn new() -> Self {
        Self {
            inner: CrosstermBackend::new(io::stdout()),
            suppress_append_lines: false,
        }
    }

    pub fn set_suppress_append_lines(&mut self, suppress: bool) {
        self.suppress_append_lines = suppress;
    }
}

impl Default for InlineBackend {
    fn default() -> Self {
        Self::new()
    }
}

/// When `inline_height` rows already fit below the origin on screen, rebuilding the viewport
/// does not need another newline. Near the bottom with too few rows, `append_lines` must really
/// run, otherwise ratatui treats it as "scrolled" and shifts y upward.
pub fn should_suppress_inline_append(cursor_y: u16, rows: u16, inline_height: u16) -> bool {
    let available = rows.saturating_sub(cursor_y).saturating_sub(1);
    let need = inline_height.saturating_sub(1);
    need.saturating_sub(available) == 0
}

impl io::Write for InlineBackend {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.inner.write(buf)
    }

    fn flush(&mut self) -> io::Result<()> {
        io::Write::flush(&mut self.inner)
    }
}

impl Backend for InlineBackend {
    type Error = io::Error;

    fn draw<'a, I>(&mut self, content: I) -> io::Result<()>
    where
        I: Iterator<Item = (u16, u16, &'a Cell)>,
    {
        self.inner.draw(content)
    }

    fn append_lines(&mut self, n: u16) -> io::Result<()> {
        if self.suppress_append_lines {
            return Ok(());
        }
        self.inner.append_lines(n)
    }

    fn hide_cursor(&mut self) -> io::Result<()> {
        self.inner.hide_cursor()
    }

    fn show_cursor(&mut self) -> io::Result<()> {
        self.inner.show_cursor()
    }

    fn get_cursor_position(&mut self) -> io::Result<Position> {
        self.inner.get_cursor_position()
    }

    fn set_cursor_position<P: Into<Position>>(&mut self, position: P) -> io::Result<()> {
        self.inner.set_cursor_position(position)
    }

    fn clear(&mut self) -> io::Result<()> {
        self.inner.clear()
    }

    fn clear_region(&mut self, clear_type: ClearType) -> io::Result<()> {
        self.inner.clear_region(clear_type)
    }

    fn size(&self) -> io::Result<Size> {
        self.inner.size()
    }

    fn window_size(&mut self) -> io::Result<WindowSize> {
        self.inner.window_size()
    }

    fn flush(&mut self) -> io::Result<()> {
        Backend::flush(&mut self.inner)
    }
}

pub trait InlineRecreate {
    /// Only for horizontal shrink: ratatui inline `resize` clears the screen and sets y to 0.
    fn recreate_inline_at_row(&mut self, y: u16, height: u16) -> Result<()>;
    /// Grow/shrink: swap the Inline height without the full-screen clear used for shrink.
    fn set_inline_height(&mut self, y: u16, old_height: u16, new_height: u16) -> Result<()>;
}

impl InlineRecreate for Terminal<InlineBackend> {
    fn recreate_inline_at_row(&mut self, y: u16, height: u16) -> Result<()> {
        recreate_inline_terminal_at(self, y, height)
    }

    fn set_inline_height(&mut self, y: u16, old_height: u16, new_height: u16) -> Result<()> {
        set_inline_viewport_height(self, y, old_height, new_height)
    }
}

impl InlineRecreate for Terminal<CrosstermBackend<io::Stdout>> {
    fn recreate_inline_at_row(&mut self, _y: u16, _height: u16) -> Result<()> {
        Ok(())
    }

    fn set_inline_height(&mut self, _y: u16, _old_height: u16, _new_height: u16) -> Result<()> {
        Ok(())
    }
}

/// ratatui `resize` on horizontal shrink clears the screen and sets the inline origin to y=0 (#2355).
/// We cannot push the viewport back with `insert_before` — that inserts blank lines and separates
/// the fragments from the new frame. Only called when the width shrinks: rebuild at the original y
/// and clear the wrapped-line fragments.
fn recreate_inline_terminal_at(
    terminal: &mut Terminal<InlineBackend>,
    at_y: u16,
    height: u16,
) -> Result<()> {
    let (_, rows) = crossterm::terminal::size().map_err(|err| anyhow!("{err}"))?;
    let y = at_y.min(rows.saturating_sub(1));
    let inline_height = height.max(1).min(rows.max(1));
    let suppress = should_suppress_inline_append(y, rows, inline_height);
    execute!(io::stdout(), Hide, MoveTo(0, y)).map_err(|err| anyhow!("{err}"))?;
    let mut backend = InlineBackend::new();
    backend.set_suppress_append_lines(suppress);
    *terminal = Terminal::with_options(
        backend,
        TerminalOptions {
            viewport: Viewport::Inline(inline_height),
        },
    )
    .map_err(|err| anyhow!("{err}"))?;
    terminal.backend_mut().set_suppress_append_lines(false);
    terminal.clear().map_err(|err| anyhow!("{err}"))?;
    terminal.hide_cursor().map_err(|err| anyhow!("{err}"))?;
    Ok(())
}

/// The `n` in ratatui `Viewport::Inline(n)` only takes effect at construction, so growing the
/// height requires a fresh Terminal. When there is enough space, suppress append and skip the
/// clear (grow in place). When growth at the bottom edge forces a newline, let `with_options`
/// scroll from column 0 of the origin and then clear — the first frame assumes the area is empty,
/// so fragments brought in by the scroll must be removed.
fn set_inline_viewport_height(
    terminal: &mut Terminal<InlineBackend>,
    at_y: u16,
    old_height: u16,
    new_height: u16,
) -> Result<()> {
    let (_, rows) = crossterm::terminal::size().map_err(|err| anyhow!("{err}"))?;
    let y = at_y.min(rows.saturating_sub(1));
    let new_height = new_height.max(1).min(rows.max(1));
    let scrolled = new_height > old_height && !should_suppress_inline_append(y, rows, new_height);
    execute!(io::stdout(), Hide, MoveTo(0, y)).map_err(|err| anyhow!("{err}"))?;
    let mut backend = InlineBackend::new();
    backend.set_suppress_append_lines(!scrolled);
    *terminal = Terminal::with_options(
        backend,
        TerminalOptions {
            viewport: Viewport::Inline(new_height),
        },
    )
    .map_err(|err| anyhow!("{err}"))?;
    terminal.backend_mut().set_suppress_append_lines(false);
    if scrolled {
        // Scrolling pulled old UI / cargo output into the new viewport; ratatui's first frame
        // assumes the area is empty, so it must be cleared first.
        terminal.clear().map_err(|err| anyhow!("{err}"))?;
    } else if new_height < old_height {
        let erase_from = y.saturating_add(new_height);
        if erase_from < rows {
            execute!(
                io::stdout(),
                MoveTo(0, erase_from),
                Clear(CrosstermClearType::FromCursorDown)
            )
            .map_err(|err| anyhow!("{err}"))?;
        }
    }
    terminal.hide_cursor().map_err(|err| anyhow!("{err}"))?;
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum InlineLeaveAction {
    None,
    MoveTo(u16),
    /// Content sits on the last row: first go to column 0 of that row, then scroll one line
    /// out with a newline for the shell.
    ScrollLastRow,
}

pub(super) fn inline_leave_action(content_bottom: u16, rows: u16) -> InlineLeaveAction {
    if content_bottom == 0 {
        InlineLeaveAction::None
    } else if content_bottom >= rows {
        InlineLeaveAction::ScrollLastRow
    } else {
        InlineLeaveAction::MoveTo(content_bottom)
    }
}

/// On Ctrl+C / exit the cursor is still inside the input box. zsh marks the unterminated line
/// with `%` and prints the prompt over it, covering the bottom border and footer. Move the cursor
/// to the next line (column 0) below the last inline block so the shell prompt appears under the
/// complete UI.
pub fn leave_inline_prompt<B: Backend + io::Write>(
    terminal: &mut Terminal<B>,
    content_bottom: u16,
) -> Result<()> {
    let (_, rows) = crossterm::terminal::size().map_err(|err| anyhow!("{err}"))?;
    match inline_leave_action(content_bottom, rows) {
        InlineLeaveAction::None => {}
        InlineLeaveAction::MoveTo(y) => {
            execute!(terminal.backend_mut(), MoveTo(0, y)).map_err(|err| anyhow!("{err}"))?;
        }
        InlineLeaveAction::ScrollLastRow => {
            // In raw mode `\n` is only an LF: it does not return to column 0, and a single newline
            // from inside the input box cannot get past the footer.
            execute!(
                terminal.backend_mut(),
                MoveTo(0, rows.saturating_sub(1)),
                Print("\n")
            )
            .map_err(|err| anyhow!("{err}"))?;
        }
    }
    Ok(())
}

pub(super) struct InlineScrollback {
    committed: usize,
}

impl InlineScrollback {
    pub fn new() -> Self {
        Self { committed: 0 }
    }

    pub fn reset(&mut self) {
        self.committed = 0;
    }

    pub fn committed_count(&self) -> usize {
        self.committed
    }

    fn uncommitted_range(&self, total: usize, busy: bool) -> Option<std::ops::Range<usize>> {
        if busy {
            return None;
        }
        if total < self.committed {
            // The main-screen scrollback cannot retract already-inserted lines; after a shrink we
            // must not re-insert them from 0.
            return None;
        }
        if total > self.committed {
            Some(self.committed..total)
        } else {
            None
        }
    }

    fn mark_committed(&mut self, total: usize) {
        self.committed = total;
    }
}

impl TuiShell {
    pub fn is_inline_mode(&self) -> bool {
        self.inline_mode
    }

    pub fn current_tui_mode(&self) -> &'static str {
        if self.inline_mode {
            crate::ports::TUI_MODE_INLINE
        } else {
            crate::ports::TUI_MODE_FULLSCREEN
        }
    }

    pub fn take_pending_tui_mode(&mut self) -> Option<String> {
        self.pending_tui_mode.take()
    }

    pub fn apply_tui_mode(&mut self, inline: bool) {
        self.inline_mode = inline;
        if inline {
            self.ui_runtime_state = crate::ui::UiRuntimeState::default();
            // Do not reset the scrollback: lines inserted with insert_before before switching to
            // fullscreen are still on the main screen; re-inserting them on return would duplicate.
        } else {
            self.ui_runtime_state = crate::ui::UiRuntimeState::from_terminal_query();
        }
    }

    pub fn inline_needed_viewport_height(&self, term_width: u16, term_rows: u16) -> u16 {
        crate::ui::inline_needed_viewport_height(&self.view_model(), term_width, term_rows)
    }

    pub fn sync_inline_scrollback<B: Backend + io::Write>(
        &mut self,
        terminal: &mut Terminal<B>,
    ) -> Result<()> {
        if !self.inline_mode {
            return Ok(());
        }
        let app = self.view_model();
        let width = terminal
            .size()
            .map_err(|err| anyhow!("{err}"))?
            .width
            .max(1);
        let lines = crate::ui::inline_history_visual_lines(&app, width);
        let busy = app.pending_response_active;
        let total = lines.len();
        if total < self.inline_scrollback.committed_count() {
            self.inline_scrollback.mark_committed(total);
            return Ok(());
        }
        let Some(range) = self.inline_scrollback.uncommitted_range(total, busy) else {
            return Ok(());
        };
        insert_scrollback_lines(terminal, lines[range].to_vec())?;
        self.inline_scrollback.mark_committed(total);
        Ok(())
    }
}

fn insert_scrollback_lines<B: Backend>(
    terminal: &mut Terminal<B>,
    lines: Vec<Line<'static>>,
) -> Result<()> {
    if lines.is_empty() {
        return Ok(());
    }
    const CHUNK: usize = 256;
    let mut rest = lines;
    while !rest.is_empty() {
        let n = rest.len().min(CHUNK);
        let chunk: Vec<_> = rest.drain(..n).collect();
        let height = chunk.len() as u16;
        terminal
            .insert_before(height, |buf| {
                Paragraph::new(chunk).render(buf.area, buf);
                clear_wide_char_continuation_cells(buf);
            })
            .map_err(|err| anyhow!("{err}"))?;
    }
    Ok(())
}

/// Without scrolling-regions, `insert_before` prints cell by cell. Paragraph writes a wide
/// character at x while x+1 still holds the default space; printed as-is it becomes "欢 迎".
/// Clear the placeholder cells after wide characters to an empty string; Print("") takes no columns.
fn clear_wide_char_continuation_cells(buf: &mut Buffer) {
    let area = buf.area;
    for y in area.y..area.y.saturating_add(area.height) {
        let mut x = area.x;
        let end = area.x.saturating_add(area.width);
        while x < end {
            let width = UnicodeWidthStr::width(buf[(x, y)].symbol()).max(1) as u16;
            if width >= 2 {
                for dx in 1..width {
                    let nx = x.saturating_add(dx);
                    if nx < end {
                        buf[(nx, y)].set_symbol("");
                    }
                }
            }
            x = x.saturating_add(width);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        InlineLeaveAction, InlineScrollback, inline_leave_action, should_suppress_inline_append,
    };

    #[test]
    fn idle_commits_only_new_lines() {
        let mut scrollback = InlineScrollback::new();
        assert_eq!(scrollback.uncommitted_range(5, false), Some(0..5));
        scrollback.mark_committed(5);
        assert_eq!(scrollback.committed_count(), 5);
        assert_eq!(scrollback.uncommitted_range(5, false), None);
        assert_eq!(scrollback.uncommitted_range(8, true), None);
        assert_eq!(scrollback.uncommitted_range(8, false), Some(5..8));
        scrollback.mark_committed(8);
        assert_eq!(scrollback.uncommitted_range(8, false), None);
    }

    #[test]
    fn history_shrink_does_not_reinsert() {
        let mut scrollback = InlineScrollback::new();
        scrollback.mark_committed(10);
        assert_eq!(scrollback.uncommitted_range(3, false), None);
        scrollback.mark_committed(3);
        assert_eq!(scrollback.committed_count(), 3);
        assert_eq!(scrollback.uncommitted_range(3, false), None);
        assert_eq!(scrollback.uncommitted_range(5, false), Some(3..5));
        scrollback.reset();
        assert_eq!(scrollback.committed_count(), 0);
        assert_eq!(scrollback.uncommitted_range(3, false), Some(0..3));
    }

    #[test]
    fn suppress_append_only_when_viewport_fits_below_cursor() {
        assert!(should_suppress_inline_append(8, 59, 5));
        assert!(should_suppress_inline_append(53, 59, 5));
        assert!(!should_suppress_inline_append(56, 59, 5));
    }

    #[test]
    fn leave_scrolls_from_last_row_when_content_hits_screen_bottom() {
        assert_eq!(inline_leave_action(0, 59), InlineLeaveAction::None);
        assert_eq!(inline_leave_action(13, 59), InlineLeaveAction::MoveTo(13));
        assert_eq!(inline_leave_action(55, 59), InlineLeaveAction::MoveTo(55));
        assert_eq!(inline_leave_action(59, 59), InlineLeaveAction::ScrollLastRow);
        assert_eq!(inline_leave_action(60, 59), InlineLeaveAction::ScrollLastRow);
    }
}
