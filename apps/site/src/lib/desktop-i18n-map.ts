import type { AppLocale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";

type TranslationParams = Record<string, string | number | boolean | null | undefined> & {
  defaultValue?: string;
};

const MESSAGE_PATHS: Record<string, string> = {
  "titleBar.appMenu": "desktop.titleBar.appMenuAria",
  "titleBar.file": "desktop.titleBar.file",
  "titleBar.edit": "desktop.titleBar.edit",
  "titleBar.view": "desktop.titleBar.view",
  "titleBar.window": "desktop.titleBar.window",
  "titleBar.help": "desktop.titleBar.help",
  "titleBar.minimize": "desktop.titleBar.minimize",
  "titleBar.maximize": "desktop.titleBar.maximize",
  "titleBar.close": "desktop.titleBar.close",
  "titleBar.newSession": "desktop.window.newSession",
  "titleBar.quit": "desktop.titleBar.close",
  "titleBar.undo": "desktop.titleBar.edit",
  "titleBar.redo": "desktop.titleBar.edit",
  "titleBar.cut": "desktop.titleBar.edit",
  "titleBar.copy": "desktop.titleBar.edit",
  "titleBar.paste": "desktop.titleBar.edit",
  "titleBar.selectAll": "desktop.titleBar.edit",
  "titleBar.reload": "desktop.titleBar.view",
  "titleBar.forceReload": "desktop.titleBar.view",
  "titleBar.devTools": "desktop.titleBar.view",
  "titleBar.toggleFullscreen": "desktop.titleBar.view",
  "titleBar.about": "desktop.titleBar.help",
  "app.sidebarAndTools": "desktop.window.toolbarAria",
  "app.hideSidebar": "desktop.window.hideSidebar",
  "app.showSidebar": "desktop.window.showSidebar",
  "app.collapseTools": "desktop.window.collapseTools",
  "app.expandTools": "desktop.window.expandTools",
  "app.selectWorkspace": "desktop.conversation.workspaceSelectorAria",
  "app.searchWorkspace": "desktop.conversation.workspaceSearchPlaceholder",
  "app.addWorkspace": "desktop.conversation.addWorkspace",
  "app.noWorkspace": "desktop.files.noWorkspace",
  "app.noMatches": "desktop.conversation.noMatches",
  "app.selectModel": "desktop.conversation.selectModelAria",
  "app.filterModels": "desktop.conversation.modelFilterPlaceholder",
  "app.noModelsAvailable": "desktop.conversation.noModels",
  "app.send": "desktop.conversation.sendTitle",
  "app.abort": "desktop.conversation.sendTitle",
  "sidebar.newSession": "desktop.sessionSidebar.newSession",
  "sidebar.currentWorkspace": "desktop.sessionSidebar.currentWorkspace",
  "sidebar.extensions": "desktop.sessionSidebar.extensionsButton",
  "sidebar.settingsTabsAria": "desktop.sessionSidebar.settingsTabsAria",
  "sidebar.workspaceSessionsAria": "desktop.sessionSidebar.workspaceSessionsAria",
  "sidebar.settingsNavAria": "desktop.sessionSidebar.settingsNavSidebarAria",
  "sidebar.sessionNavAria": "desktop.sessionSidebar.sessionsSidebarAria",
  "sidebar.workspace": "desktop.sessionSidebar.workspaceHeading",
  "sidebar.resizeWidth": "desktop.tools.resizeAria",
  "composer.planChipLabel": "desktop.conversation.plan",
  "composer.askChipLabel": "desktop.conversation.agent",
  "composer.loopChipLabel": "desktop.conversation.agent",
  "composer.enqueueWhileBusy": "desktop.conversation.sendTitle",
  "git.commit": "desktop.window.commitButton",
  "settings.title": "desktop.sessionSidebar.settingsHeading",
  "settings.capabilityChatLabel": "desktop.models.heading",
  "settings.capabilityImageLabel": "desktop.models.heading",
  "settings.capabilityVideoLabel": "desktop.models.heading",
  "settings.capabilityImageGenerationLabel": "desktop.models.heading",
  "settings.capabilityVideoGenerationLabel": "desktop.models.heading",
  "app.modelPickerReasoningEffort": "desktop.models.heading",
  "composer.removeAttachment": "desktop.models.deleteAction",
  "composer.openInsertPanel": "desktop.models.connectProvider",
  "composer.insert": "desktop.models.connectProvider",
  "workspace.files": "desktop.tools.filesTab",
  "workspace.shell": "desktop.tools.shellTab",
  "workspace.gitTab": "desktop.tools.gitTab",
};

const STATIC_FALLBACK: Record<AppLocale, Record<string, string>> = {
  "en-US": {
    "sidebar.loadMoreSessions": "Load more sessions",
    "sidebar.sessionBlocked": "Blocked",
    "sidebar.sessionCompleted": "Completed",
    "sidebar.sessionActions": "Session actions",
    "sidebar.workspaceActions": "Workspace actions",
    "sidebar.deleteSession": "Delete session",
    "sidebar.deleteWorkspace": "Delete workspace",
    "sidebar.cannotDeleteBusySession": "Cannot delete a running session",
    "sidebar.deleteSessionConfirm": 'Delete session "{{name}}"?',
    "sidebar.deleteWorkspaceConfirm": 'Delete workspace "{{name}}"?',
    "sidebar.noWorkspaceSessions": "No workspace sessions",
    "sidebar.automations": "Automations",
    "sidebar.extensionSettings": "Extension settings",
    "common.back": "Back",
    "common.running": "Running",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "titleBar.quit": "Quit",
    "titleBar.undo": "Undo",
    "titleBar.redo": "Redo",
    "titleBar.cut": "Cut",
    "titleBar.copy": "Copy",
    "titleBar.paste": "Paste",
    "titleBar.selectAll": "Select all",
    "titleBar.reload": "Reload",
    "titleBar.forceReload": "Force reload",
    "titleBar.devTools": "Developer tools",
    "titleBar.toggleFullscreen": "Toggle fullscreen",
    "titleBar.about": "About Spirit Agent",
  },
  "zh-CN": {
    "sidebar.loadMoreSessions": "加载更多会话",
    "sidebar.sessionBlocked": "已阻塞",
    "sidebar.sessionCompleted": "已完成",
    "sidebar.sessionActions": "会话操作",
    "sidebar.workspaceActions": "工作区操作",
    "sidebar.deleteSession": "删除会话",
    "sidebar.deleteWorkspace": "删除工作区",
    "sidebar.cannotDeleteBusySession": "无法删除运行中的会话",
    "sidebar.deleteSessionConfirm": "删除会话「{{name}}」？",
    "sidebar.deleteWorkspaceConfirm": "删除工作区「{{name}}」？",
    "sidebar.noWorkspaceSessions": "暂无工作区会话",
    "sidebar.automations": "自动化",
    "sidebar.extensionSettings": "扩展设置",
    "common.back": "返回",
    "common.running": "运行中",
    "common.cancel": "取消",
    "common.delete": "删除",
    "titleBar.quit": "退出",
    "titleBar.undo": "撤销",
    "titleBar.redo": "重做",
    "titleBar.cut": "剪切",
    "titleBar.copy": "复制",
    "titleBar.paste": "粘贴",
    "titleBar.selectAll": "全选",
    "titleBar.reload": "重新加载",
    "titleBar.forceReload": "强制重新加载",
    "titleBar.devTools": "开发者工具",
    "titleBar.toggleFullscreen": "切换全屏",
    "titleBar.about": "关于 Spirit Agent",
  },
};

function getByPath(object: unknown, path: string): string | undefined {
  const value = path.split(".").reduce<unknown>((current, segment) => {
    if (current && typeof current === "object" && segment in current) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, object);
  return typeof value === "string" ? value : undefined;
}

function formatTranslation(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }
  if (params.defaultValue && template === params.defaultValue) {
    return params.defaultValue;
  }
  return Object.entries(params).reduce((result, [name, value]) => {
    if (name === "defaultValue") {
      return result;
    }
    const text = value == null ? "" : String(value);
    return result.replaceAll(`{{${name}}}`, text).replaceAll(`{${name}}`, text);
  }, template);
}

export function resolveDesktopTranslation(
  key: string,
  locale: AppLocale,
  messages: Messages,
  params?: TranslationParams,
): string {
  if (params?.defaultValue) {
    return formatTranslation(params.defaultValue, params);
  }

  const messagePath = MESSAGE_PATHS[key];
  const fromMessages = messagePath ? getByPath(messages, messagePath) : undefined;
  const fromStatic = STATIC_FALLBACK[locale][key] ?? STATIC_FALLBACK["en-US"][key];
  const template = fromMessages ?? fromStatic ?? key.split(".").pop() ?? key;
  return formatTranslation(template, params);
}

export function createDesktopTranslator(locale: AppLocale, messages: Messages) {
  const t = (key: string, params?: TranslationParams) =>
    resolveDesktopTranslation(key, locale, messages, params);
  return { t, i18n: { t, language: locale } };
}
