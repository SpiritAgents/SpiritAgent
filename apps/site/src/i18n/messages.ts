import type { AppLocale } from "@/i18n/config";

type DesktopConversationCopy = {
  manualAssistantResponse: string;
  demoUserPrompt: string;
  demoThinkingText: string;
  demoAssistantResponse: string;
  agentDemo: DesktopAgentDemoCopy;
  designDemo: DesktopDesignDemoCopy;
  workspaceSelectorAria: string;
  workspaceSearchPlaceholder: string;
  noMatches: string;
  addWorkspace: string;
  runModeAria: string;
  agent: string;
  plan: string;
  selectModelAria: string;
  modelFilterPlaceholder: string;
  noModels: string;
  sendTitle: string;
  thinking: string;
  thought: string;
  compaction: string;
  runningToolHeadline: string;
  runningToolHeadlineSucceeded: string;
  runningToolHeadlineDetail: string;
  runningToolDetails: [string, string];
  runningToolOutput: string;
  emptyTitle: string;
  composerPlaceholder: string;
};

type DesktopAgentDemoCopy = {
  demoUserPrompt: string;
  demoThinkingText: string;
  imageGenRunningHeadline: string;
  imageGenSucceededHeadline: string;
  createPlanHeadlineRunning: string;
  createPlanHeadlineSucceeded: string;
  demoAssistantResponse: string;
  planMarkdown: string;
  planPath: string;
  generatingImage: string;
  previewUnavailable: string;
  viewLargeImage: string;
  closeImagePreview: string;
};

type DesktopDesignDemoCopy = {
  demoUserPrompt: string;
  demoThinkingText: string;
  editFileRunningHeadline: string;
  editFileSucceededHeadline: string;
  editFileRunningDetail: string;
  editFilePath: string;
  demoAssistantResponse: string;
  improvedHeadline: string;
  selectedElementHtml: string;
};

type DesktopModelsCopy = {
  customProvider: string;
  heading: string;
  connectProvider: string;
  current: string;
  savedKey: string;
  cannotDeleteCurrent: string;
  deleteAction: string;
  deleteDialogTitle: string;
  deleteDialogDescription(modelName: string): string;
  cancel: string;
  providerDialogTitle: string;
  providerDialogDescription: string;
  searchPlaceholder: string;
  noMatches: string;
  connectDialogDescriptionCustom: string;
  connectDialogDescriptionDefault: string;
  addModeLabel: string;
  addModeAria: string;
  addSingle: string;
  addAll: string;
  modelNameLabel: string;
  modelNamePlaceholder: string;
  endpointLabel: string;
  optionalPlaceholder: string;
  apiKeyLabel: string;
  apiKeyPlaceholder: string;
  addThisModel: string;
  adding: string;
  addProvider: string;
  customConnectionTitle: string;
  connectProviderTitle: string;
};

type DesktopWindowCopy = {
  toolbarAria: string;
  hideSidebar: string;
  showSidebar: string;
  commitButton: string;
  collapseTools: string;
  expandTools: string;
  settingsPlaceholderTitle: string;
  settingsPlaceholderDescription: string;
  marketplacePlaceholderTitle: string;
  marketplacePlaceholderDescription: string;
  previewEditorOnlyTextError: string;
  hostStatus: string;
  mcpReady: string;
  newSession: string;
};

type DesktopCommitCopy = {
  modeCommit: string;
  modeCommitHint: string;
  modeCommitAndPush: string;
  modeCommitAndPushHint: string;
  title: string;
  currentBranch(branch: string): string;
  messageLabel: string;
  messagePlaceholder: string;
  modeLabel: string;
  modeAria: string;
  cancel: string;
  submitCommit: string;
  submitCommitAndPush: string;
};

type DesktopTitleBarCopy = {
  appMenuAria: string;
  file: string;
  edit: string;
  view: string;
  window: string;
  help: string;
  minimize: string;
  maximize: string;
  close: string;
};

type DesktopSessionSidebarCopy = {
  currentWorkspace: string;
  basics: string;
  models: string;
  skills: string;
  dreams: string;
  extensions: string;
  mcps: string;
  appearance: string;
  settingsNavSidebarAria: string;
  sessionsSidebarAria: string;
  back: string;
  settingsHeading: string;
  pageNavigation: string;
  newSession: string;
  extensionsButton: string;
  workspaceHeading: string;
  settingsTabsAria: string;
  workspaceSessionsAria: string;
  settingsButton: string;
};

type DesktopFilesCopy = {
  noWorkspace: string;
  fileListAria: string;
  planNotCreated: string;
  unsavedCloseConfirm: string;
  saveAria: string;
  saveShortcutTitle: string;
  closeAria: string;
};

type DesktopToolsCopy = {
  filesTab: string;
  shellTab: string;
  gitTab: string;
  browserTab: string;
  browserBack: string;
  browserForward: string;
  browserReload: string;
  browserAddressBar: string;
  browserPickerToggle: string;
  resizeAria: string;
  panelAria: string;
  tabListAria: string;
  gitChangesHeading: string;
  gitHistoryHeading: string;
  gitRefresh: string;
  gitStageAll: string;
};

type DesktopShellCopy = {
  helpTitle: string;
  helpDir: string;
  helpTree: string;
  helpGitStatus: string;
  helpBuild: string;
  helpClear: string;
  currentWorkspace(workspaceRoot: string): string;
  unsupportedCommand(command: string): string;
  typeHelp: string;
  noWorkspace: string;
  retry: string;
  openSystemTerminal: string;
  exited(exitCode: number): string;
};

type DesktopPreviewCopy = {
  siteReadmeDescription: string;
  desktopReadmeDescription: string;
  generatedWorkspaceDescription(label: string): string;
  generatedWorkspaceOverview(root: string): string;
  heroSession: string;
  landingSession: string;
  agentSession: string;
  designSession: string;
  desktopSession: string;
};

export type Messages = {
  meta: {
    title: string;
    description: string;
  };
  common: {
    brand: string;
    download: string;
    downloadForPlatform(platform: string): string;
  };
  hero: {
    sectionAria: string;
    homeAria: string;
    primaryNavAria: string;
    nav: {
      features: string;
      byok: string;
      agent: string;
      resources: string;
      docs: string;
      changelog: string;
      github: string;
      explore: string;
      exploreFeatures: string;
      exploreResources: string;
      back: string;
      openMenu: string;
      closeMenu: string;
    };
    tagline: string;
    headline: string;
  };
  landing: {
    sectionAria: string;
    featureHeading: [string, string, string];
    featureBody: string;
    agent: {
      sectionAria: string;
      featureHeading: [string, string, string];
      featureBody: string;
    };
    ctaSectionAria: string;
    ctaTitle: string;
    trio: {
      sectionAria: string;
      completion: {
        title: string;
        body: string;
      };
      toolCards: {
        title: string;
        body: string;
        userMessage: string;
        searchRunning: string;
        searchSucceeded: string;
        searchQuery: string;
        readRunning: string;
        readSucceeded: string;
        editRunning: string;
        editSucceeded: string;
        fileName: string;
        assistantMessage: string;
      };
      placeholder: {
        title: string;
        body: string;
      };
    };
  };
  download: {
    metaTitle: string;
    metaDescription: string;
    title: string;
    sectionAria: string;
    desktop: string;
    cli: string;
    acp: string;
    copyInstall: string;
    copied: string;
    comingSoon: string;
    listingInProgress: string;
    cliLogoTitle: string;
    cliUserMessage: string;
    cliAssistantMessage: string;
    cliUserFollowUp: string;
    cliAssistantFollowUp: string;
    cliFooter: string;
  };
  footer: {
    navAria: string;
    externalAria: string;
    columns: {
      features: string;
      resources: string;
    };
    agent: string;
    linkHome: string;
    changelog: string;
    openSourceLicenses: string;
    copyrightLine(year: number): string;
  };
  desktop: {
    titleBar: DesktopTitleBarCopy;
    sessionSidebar: DesktopSessionSidebarCopy;
    conversation: DesktopConversationCopy;
    models: DesktopModelsCopy;
    window: DesktopWindowCopy;
    commit: DesktopCommitCopy;
    files: DesktopFilesCopy;
    tools: DesktopToolsCopy;
    shell: DesktopShellCopy;
    previews: DesktopPreviewCopy;
  };
  docs: {
    search: string;
    searchPlaceholder: string;
    searchNoResults: string;
    onThisPage: string;
    openMenu: string;
    closeMenu: string;
  };
};

const enUS: Messages = {
  meta: {
    title: "Spirit Agent",
    description:
      "Spirit Agent is an open source AI agent you run with your models, your keys, and your workflow.",
  },
  common: {
    brand: "Spirit Agent",
    download: "Download",
    downloadForPlatform: (platform) => `Download for ${platform}`,
  },
  hero: {
    sectionAria: "Spirit Agent",
    homeAria: "Spirit Agent home",
    primaryNavAria: "Primary",
    nav: {
      features: "Features",
      byok: "BYOK",
      agent: "Agent",
      resources: "Resources",
      docs: "Docs",
      changelog: "Changelog",
      github: "GitHub",
      explore: "Explore",
      exploreFeatures: "Explore Features",
      exploreResources: "Explore Resources",
      back: "Back",
      openMenu: "Open menu",
      closeMenu: "Close menu",
    },
    tagline:
      "Grounded in your workspace, equipped with real tools, and ready to plan, execute, and ship alongside you.",
    headline: "An open-source AI agent\nbuilt to multiply your productivity.",
  },
  download: {
    metaTitle: "Download Spirit Agent",
    metaDescription: "Download Spirit Agent for Desktop, install the CLI, or watch for ACP.",
    title: "The same agent, across all your work.",
    sectionAria: "The same agent, across all your work.",
    desktop: "Desktop",
    cli: "CLI",
    acp: "ACP",
    copyInstall: "Copy install command",
    copied: "Copied",
    comingSoon: "Coming soon™",
    listingInProgress: "Listing…",
    cliLogoTitle: "Spirit Agent",
    cliUserMessage: "Review auth.ts and fix the session refresh bug.",
    cliAssistantMessage: "I'll inspect auth.ts and patch the failing session check.",
    cliUserFollowUp: "Also add a regression test.",
    cliAssistantFollowUp: "Added a focused test for the refresh path. Ready to run.",
    cliFooter: "Agent  |  Default Approval  |  Loop Off          gpt-5",
  },
  landing: {
    sectionAria: "Spirit Agent content",
    featureHeading: ["Your models.", "Your keys.", "Your control."],
    featureBody:
      "Spirit does not lock you into a hosted stack. Bring a key from any provider, add it once, and use the same agent workflow across all of them.",
    agent: {
      sectionAria: "Spirit Agent productivity",
      featureHeading: ["Plan with context.", "Execute with tools.", "Ship in your workspace."],
      featureBody:
        "Spirit plans before it acts: generate mockups, write structured plans, and execute against your repo without leaving the desktop shell.",
    },
    ctaSectionAria: "Download Spirit Agent",
    ctaTitle: "Try Spirit.",
    trio: {
      sectionAria: "Capability previews",
      completion: {
        title: "Tab Tab Tab.",
        body: "Predicts your next idea before you type it.",
      },
      toolCards: {
        title: "Say it. Ship it.",
        body: "Point it at a large codebase.",
        userMessage: "Help me fix the API endpoint for the OpenAI provider.",
        searchRunning: "Searching",
        searchSucceeded: "Searched",
        searchQuery: "openai|provider|endpoint",
        readRunning: "Reading",
        readSucceeded: "Read",
        editRunning: "Editing",
        editSucceeded: "Edited",
        fileName: "provider.ts",
        assistantMessage: "All set! I changed the API endpoint to `api.openai.com`.",
      },
      placeholder: {
        title: "Haven't figured this one out yet.",
        body: "Placeholder for now.",
      },
    },
  },
  footer: {
    navAria: "Footer",
    externalAria: "External links",
    columns: {
      features: "Features",
      resources: "Resources",
    },
    agent: "Agent",
    linkHome: "Home",
    changelog: "Changelog",
    openSourceLicenses: "Open source licenses",
    copyrightLine: (year) => `© ${year} Spirit Agent. Open source AI agent.`,
  },
  desktop: {
    titleBar: {
      appMenuAria: "Application menu",
      file: "File",
      edit: "Edit",
      view: "View",
      window: "Window",
      help: "Help",
      minimize: "Minimize",
      maximize: "Maximize",
      close: "Close",
    },
    sessionSidebar: {
      currentWorkspace: "Current workspace",
      basics: "Basics",
      models: "Models",
      skills: "Skills",
      dreams: "Dreams",
      extensions: "Extensions",
      mcps: "MCPs",
      appearance: "Appearance",
      settingsNavSidebarAria: "Settings navigation sidebar",
      sessionsSidebarAria: "Sessions and settings sidebar",
      back: "Back",
      settingsHeading: "Settings",
      pageNavigation: "Page navigation",
      newSession: "New session",
      extensionsButton: "Extensions",
      workspaceHeading: "Workspace",
      settingsTabsAria: "Settings tabs",
      workspaceSessionsAria: "Workspace sessions",
      settingsButton: "Settings",
    },
    conversation: {
      manualAssistantResponse: "Download Spirit Agent.",
      demoUserPrompt: "Review the current landing page and tell me what to improve next.",
      demoThinkingText: `Checking the current Hero structure.
Looking for the most visible gaps in the conversation surface.
Preparing a short implementation summary.`,
      demoAssistantResponse: `Here is the next step I would take.

- Replace the empty conversation area with a real streaming demo.
- Keep the Hero window interruptible so visitors can take control immediately.
- Reuse the Desktop message styles for Thinking and tool calls instead of approximating them.`,
      workspaceSelectorAria: "Choose workspace",
      workspaceSearchPlaceholder: "Search workspaces",
      noMatches: "No matches",
      addWorkspace: "Add workspace",
      runModeAria: "Run mode",
      agent: "Agent",
      plan: "Plan",
      selectModelAria: "Choose model",
      modelFilterPlaceholder: "Filter models",
      noModels: "No models available",
      sendTitle: "Send (Ctrl+Enter)",
      thinking: "Thinking",
      thought: "Thought",
      compaction: "Compaction",
      runningToolHeadline: "Viewing",
      runningToolHeadlineSucceeded: "Read",
      runningToolHeadlineDetail: "workspace files",
      runningToolDetails: [
        "Opening the Hero implementation.",
        "Inspecting the Desktop window shell.",
      ],
      runningToolOutput:
        "Found a single Hero section, a reused Desktop shell, and a static conversation empty state.",
      emptyTitle: "Start something.",
      composerPlaceholder: "Type a message...",
      agentDemo: {
        demoUserPrompt:
          "Plan a landing hero refresh. Generate a mockup image first, then write the implementation plan.",
        demoThinkingText: `Reviewing the current hero layout and messaging.
Checking where a visual mockup would help the plan.
Preparing to generate an image, then draft the plan document.`,
        imageGenRunningHeadline: "Generating image",
        imageGenSucceededHeadline: "Image generation complete",
        createPlanHeadlineRunning: "Creating",
        createPlanHeadlineSucceeded: "Created",
        demoAssistantResponse: `The plan is ready in the workspace panel.

- Mockup image is embedded at the top of the plan.
- Review the goals and implementation steps when you are ready to proceed.`,
        planMarkdown: `# Landing Hero Refresh

![Hero mockup](/demo/hero-mockup.png)

## Goals
- Sharpen the productivity story in the hero and new agent section.
- Keep the desktop preview interruptible and visually aligned with the app.

## Implementation steps
1. Update hero headline and supporting copy for agent productivity.
2. Add the agent plan demo section with generate_image and create_plan flows.
3. Auto-open the plan preview in the workspace dock after create_plan.`,
        planPath: "plans/landing-hero-refresh.md",
        generatingImage: "Generating image…",
        previewUnavailable: "Preview unavailable",
        viewLargeImage: "View large image",
        closeImagePreview: "Close image preview",
      },
      designDemo: {
        demoUserPrompt: "Improve this headline — make it sharper and more compelling.",
        demoThinkingText: `Reviewing the selected hero headline.
Checking tone and clarity against the productivity story.
Preparing a stronger headline update in messages.`,
        editFileRunningHeadline: "Editing",
        editFileSucceededHeadline: "Edited",
        editFileRunningDetail: "Updating hero headline copy in i18n messages.",
        editFilePath: "src/i18n/messages.ts",
        demoAssistantResponse:
          "Updated the hero headline. Refresh the browser preview to see the new copy.",
        improvedHeadline: "The open-source AI agent\nthat multiplies your productivity.",
        selectedElementHtml: '<span class="block">built to multiply your productivity.</span>',
      },
    },
    models: {
      customProvider: "Custom",
      heading: "Models",
      connectProvider: "Connect provider",
      current: "Current",
      savedKey: "Saved key",
      cannotDeleteCurrent: "Cannot delete the current model",
      deleteAction: "Delete",
      deleteDialogTitle: "Delete model",
      deleteDialogDescription: (modelName) =>
        `Delete model "${modelName}"? Configuration and separately saved keys will be removed.`,
      cancel: "Cancel",
      providerDialogTitle: "Choose provider",
      providerDialogDescription: "Choose a provider, then enter the connection details.",
      searchPlaceholder: "Search",
      noMatches: "No matches",
      connectDialogDescriptionCustom: "Enter the endpoint and key.",
      connectDialogDescriptionDefault: "Enter an API key to connect.",
      addModeLabel: "How to add models",
      addModeAria: "How to add models",
      addSingle: "Add one",
      addAll: "Add all",
      modelNameLabel: "Model name",
      modelNamePlaceholder: "For example my-model",
      endpointLabel: "Endpoint",
      optionalPlaceholder: "Optional",
      apiKeyLabel: "API key",
      apiKeyPlaceholder: "Enter key",
      addThisModel: "Add this model",
      adding: "Adding...",
      addProvider: "Add provider",
      customConnectionTitle: "Custom connection",
      connectProviderTitle: "Connect provider",
    },
    window: {
      toolbarAria: "Sidebar and tools",
      hideSidebar: "Hide sidebar",
      showSidebar: "Show sidebar",
      commitButton: "Commit",
      collapseTools: "Collapse tools",
      expandTools: "Expand tools",
      settingsPlaceholderTitle: "Desktop settings view",
      settingsPlaceholderDescription:
        "Keeps the first-screen structure and hierarchy of the settings surface.",
      marketplacePlaceholderTitle: "Extensions marketplace view",
      marketplacePlaceholderDescription:
        "Keeps the first-screen structure and hierarchy of the marketplace surface.",
      previewEditorOnlyTextError: "Only text files in the preview editor can be opened.",
      hostStatus: "Web Hero Preview",
      mcpReady: "MCP ready",
      newSession: "New session",
    },
    commit: {
      modeCommit: "Commit",
      modeCommitHint: "Create a local commit only.",
      modeCommitAndPush: "Commit and push",
      modeCommitAndPushHint: "Commit and push to the current remote branch.",
      title: "Commit changes",
      currentBranch: (branch) => `Current branch: ${branch || "main"}`,
      messageLabel: "Commit message",
      messagePlaceholder: "Commit message. Leave empty to auto-generate.",
      modeLabel: "Mode",
      modeAria: "Commit mode",
      cancel: "Cancel",
      submitCommit: "Commit",
      submitCommitAndPush: "Commit and push",
    },
    files: {
      noWorkspace: "Connect a workspace to browse files",
      fileListAria: "File list",
      planNotCreated:
        "Plan has not been created yet. After create_plan writes a file, the plan will appear here.",
      unsavedCloseConfirm: "You have unsaved changes. Close anyway?",
      saveAria: "Save",
      saveShortcutTitle: "Ctrl+S / Cmd+S",
      closeAria: "Close",
    },
    tools: {
      filesTab: "Files",
      shellTab: "Shell",
      gitTab: "Git",
      browserTab: "Browser",
      browserBack: "Back",
      browserForward: "Forward",
      browserReload: "Reload",
      browserAddressBar: "Address bar",
      browserPickerToggle: "Select element",
      resizeAria: "Resize tools panel",
      panelAria: "Workspace tools",
      tabListAria: "Tool tabs",
      gitChangesHeading: "Changes",
      gitHistoryHeading: "History",
      gitRefresh: "Refresh",
      gitStageAll: "Stage all",
    },
    shell: {
      helpTitle: "Mock shell commands:",
      helpDir: "  dir / ls           Browse preview workspace files",
      helpTree: "  tree               Print a workspace tree summary",
      helpGitStatus: "  git status         Show mock Git status",
      helpBuild: "  npm run build      Simulate a site build",
      helpClear: "  clear / cls        Clear the terminal",
      currentWorkspace: (workspaceRoot) => `Current workspace: ${workspaceRoot}`,
      unsupportedCommand: (command) =>
        `The term '${command}' is not recognized as a supported preview command.`,
      typeHelp: 'Type "help" to inspect the mock workspace.',
      noWorkspace: "Open a workspace to use the shell.",
      retry: "Retry",
      openSystemTerminal: "Open system terminal",
      exited: (exitCode) => `[exited, code ${exitCode}]`,
    },
    previews: {
      siteReadmeDescription: "Marketing site preview for the Spirit Agent desktop product.",
      desktopReadmeDescription: "Electron shell and web renderer for the desktop product.",
      generatedWorkspaceDescription: (label) =>
        `Mock workspace generated for the landing page ${label} preview.`,
      generatedWorkspaceOverview: (root) =>
        `Workspace root: ${root}\n\nThis mock workspace keeps the file tab interactive without mounting the full desktop runtime.`,
      heroSession: "Hero desktop recreation",
      landingSession: "Landing shell polish",
      agentSession: "Hero refresh plan",
      designSession: "Hero copy refresh",
      desktopSession: "Electron runtime parity",
    },
  },
  docs: {
    search: "Search",
    searchPlaceholder: "Search docs",
    searchNoResults: "No results",
    onThisPage: "On this page",
    openMenu: "Open docs menu",
    closeMenu: "Close docs menu",
  },
};

const zhCN: Messages = {
  meta: {
    title: "Spirit Agent",
    description:
      "Spirit Agent 是一个开源 AI Agent。你可以保留自己的模型、自己的密钥和自己的工作流。",
  },
  common: {
    brand: "Spirit Agent",
    download: "下载",
    downloadForPlatform: (platform) => `下载 ${platform} 版本`,
  },
  hero: {
    sectionAria: "Spirit Agent",
    homeAria: "Spirit Agent 首页",
    primaryNavAria: "主导航",
    nav: {
      features: "特性",
      byok: "BYOK",
      agent: "智能体",
      resources: "资源",
      docs: "文档",
      changelog: "更新日志",
      github: "GitHub",
      explore: "探索",
      exploreFeatures: "探索特性",
      exploreResources: "探索资源",
      back: "返回",
      openMenu: "打开菜单",
      closeMenu: "关闭菜单",
    },
    tagline: "扎根于你的工作区，配备真实工具，随时与你一起规划、执行并交付成果。",
    headline: "开源 AI 智能体\n旨在成倍提升您的生产力。",
  },
  download: {
    metaTitle: "下载 Spirit Agent",
    metaDescription: "下载 Spirit Agent 桌面版、安装 CLI，或关注 ACP。",
    title: "同一个智能体，贯穿你的所有工作。",
    sectionAria: "同一个智能体，贯穿你的所有工作。",
    desktop: "Desktop",
    cli: "CLI",
    acp: "ACP",
    copyInstall: "复制安装命令",
    copied: "已复制",
    comingSoon: "即将推出",
    listingInProgress: "上架中…",
    cliLogoTitle: "Spirit Agent",
    cliUserMessage: "检查 auth.ts，修好会话刷新的问题。",
    cliAssistantMessage: "我会先查看 auth.ts，再修补失败的会话检查。",
    cliUserFollowUp: "再补一个回归测试。",
    cliAssistantFollowUp: "已为刷新路径加了针对性测试，可以跑了。",
    cliFooter: "Agent  |  默认审批  |  Loop 关          gpt-5",
  },
  landing: {
    sectionAria: "Spirit Agent 内容",
    featureHeading: ["你的模型。", "你的密钥。", "你的控制权。"],
    featureBody:
      "Spirit 不会把你锁进托管栈。你可以接入任意提供商的密钥，只配置一次，再在同一套 Agent 工作流里复用。",
    agent: {
      sectionAria: "Spirit Agent 生产力",
      featureHeading: ["结合上下文规划。", "调用工具执行。", "在工作区里交付。"],
      featureBody:
        "Spirit 先规划再行动：生成示意图、写出结构化计划，并在桌面壳层内直接对你的仓库执行，无需切换上下文。",
    },
    ctaSectionAria: "下载 Spirit Agent",
    ctaTitle: "试试 Spirit。",
    trio: {
      sectionAria: "能力预览",
      completion: {
        title: "Tab Tab Tab.",
        body: "在你输入之前，预测你的下一个想法。",
      },
      toolCards: {
        title: "说出来，就交付。",
        body: "把大型代码库交给它。",
        userMessage: "帮我把 OpenAI 提供商的 API 端点纠正。",
        searchRunning: "搜索",
        searchSucceeded: "搜索",
        searchQuery: "openai|provider|endpoint",
        readRunning: "读取",
        readSucceeded: "读取",
        editRunning: "编辑",
        editSucceeded: "编辑",
        fileName: "provider.ts",
        assistantMessage: "一切就绪！我将 API 端点改为了 `api.openai.com`。",
      },
      placeholder: {
        title: "我也没想好。",
        body: "还是先占位吧。",
      },
    },
  },
  footer: {
    navAria: "页脚",
    externalAria: "外部链接",
    columns: {
      features: "特性",
      resources: "资源",
    },
    agent: "智能体",
    linkHome: "首页",
    changelog: "更新日志",
    openSourceLicenses: "开源许可",
    copyrightLine: (year) => `© ${year} Spirit Agent。开源 AI 智能体。`,
  },
  desktop: {
    titleBar: {
      appMenuAria: "应用菜单",
      file: "文件",
      edit: "编辑",
      view: "查看",
      window: "窗口",
      help: "帮助",
      minimize: "最小化",
      maximize: "最大化",
      close: "关闭",
    },
    sessionSidebar: {
      currentWorkspace: "当前工作区",
      basics: "基础",
      models: "模型",
      skills: "Skills",
      dreams: "梦境",
      extensions: "扩展",
      mcps: "MCPs",
      appearance: "外观",
      settingsNavSidebarAria: "设置导航侧栏",
      sessionsSidebarAria: "会话与设置侧栏",
      back: "返回",
      settingsHeading: "设置",
      pageNavigation: "页面导航",
      newSession: "新会话",
      extensionsButton: "扩展",
      workspaceHeading: "工作区",
      settingsTabsAria: "设置页签",
      workspaceSessionsAria: "工作区会话",
      settingsButton: "设置",
    },
    conversation: {
      manualAssistantResponse: "下载 Spirit Agent。",
      demoUserPrompt: "检查当前落地页，并告诉我下一步应该优先改进什么。",
      demoThinkingText: `正在检查当前 Hero 结构。
寻找对话界面里最明显的缺口。
准备一份简短的实现建议。`,
      demoAssistantResponse: `接下来我会这样推进。

- 把空白对话区替换成真实的流式演示。
- 让 Hero 窗口随时可中断，访客可以立刻接管。
- 直接复用桌面端消息样式来呈现 Thinking 和工具调用，而不是做近似实现。`,
      workspaceSelectorAria: "选择工作区",
      workspaceSearchPlaceholder: "搜索工作区",
      noMatches: "无匹配项",
      addWorkspace: "添加工作区",
      runModeAria: "运行方式",
      agent: "Agent",
      plan: "Plan",
      selectModelAria: "选择模型",
      modelFilterPlaceholder: "筛选模型",
      noModels: "无可用模型",
      sendTitle: "发送（Ctrl+Enter）",
      thinking: "Thinking",
      thought: "Thought",
      compaction: "Compaction",
      runningToolHeadline: "查看",
      runningToolHeadlineSucceeded: "读取",
      runningToolHeadlineDetail: "工作区文件",
      runningToolDetails: ["正在打开 Hero 实现。", "正在检查桌面窗口外壳。"],
      runningToolOutput: "发现了单一 Hero 区块、复用的桌面外壳，以及静态的对话空状态。",
      emptyTitle: "开始点什么。",
      composerPlaceholder: "输入消息…",
      agentDemo: {
        demoUserPrompt: "规划一次落地页 Hero 改版。先生成示意图，再写出实现计划。",
        demoThinkingText: `正在查看当前 Hero 布局与文案。
确认示意图应放在计划的哪个位置。
准备先生成图片，再起草计划文档。`,
        imageGenRunningHeadline: "正在生成图片",
        imageGenSucceededHeadline: "图片生成完成",
        createPlanHeadlineRunning: "创建",
        createPlanHeadlineSucceeded: "创建",
        demoAssistantResponse: `计划已写入右侧工作区面板。

- 示意图已嵌入计划文档顶部。
- 可在准备好后继续查看目标与实现步骤。`,
        planMarkdown: `# Landing Hero 改版

![Hero 示意图](/demo/hero-mockup.png)

## 目标
- 在 Hero 与新的 Agent 内容区中强化生产力叙事。
- 保持桌面预览可中断，并与应用视觉对齐。

## 实现步骤
1. 更新 Hero 标题与支撑文案，突出 Agent 生产力。
2. 新增 Agent 计划演示区，展示 generate_image 与 create_plan 流程。
3. create_plan 后自动在工作区 dock 打开计划 Markdown 预览。`,
        planPath: "plans/landing-hero-refresh.md",
        generatingImage: "正在生成图片…",
        previewUnavailable: "预览不可用",
        viewLargeImage: "查看大图",
        closeImagePreview: "关闭图片预览",
      },
      designDemo: {
        demoUserPrompt: "优化这段标题文案，让它更 sharp、更有吸引力。",
        demoThinkingText: `正在查看选中的 Hero 标题。
对照生产力叙事检查语气与清晰度。
准备在 i18n 文案中更新标题。`,
        editFileRunningHeadline: "编辑",
        editFileSucceededHeadline: "已编辑",
        editFileRunningDetail: "正在更新 i18n 中的 Hero 标题文案。",
        editFilePath: "src/i18n/messages.ts",
        demoAssistantResponse: "Hero 标题已更新。刷新浏览器预览即可看到新文案。",
        improvedHeadline: "开源 AI 智能体\n成倍释放您的生产力。",
        selectedElementHtml: '<span class="block">旨在成倍提升您的生产力。</span>',
      },
    },
    models: {
      customProvider: "自定义",
      heading: "模型",
      connectProvider: "连接提供商",
      current: "当前",
      savedKey: "已存密钥",
      cannotDeleteCurrent: "不能删除当前模型",
      deleteAction: "删除",
      deleteDialogTitle: "删除模型",
      deleteDialogDescription: (modelName) =>
        `确定删除模型「${modelName}」？配置与单独保存的密钥将一并移除。`,
      cancel: "取消",
      providerDialogTitle: "选择提供商",
      providerDialogDescription: "选择后填写连接信息。",
      searchPlaceholder: "搜索",
      noMatches: "无匹配项",
      connectDialogDescriptionCustom: "填写端点与密钥。",
      connectDialogDescriptionDefault: "填写 API Key 即可连接。",
      addModeLabel: "模型添加方式",
      addModeAria: "模型添加方式",
      addSingle: "仅添加单个",
      addAll: "添加所有",
      modelNameLabel: "模型名称",
      modelNamePlaceholder: "例如 my-model",
      endpointLabel: "端点",
      optionalPlaceholder: "可选",
      apiKeyLabel: "API Key",
      apiKeyPlaceholder: "输入密钥",
      addThisModel: "添加此模型",
      adding: "添加中…",
      addProvider: "添加提供商",
      customConnectionTitle: "自定义连接",
      connectProviderTitle: "连接提供商",
    },
    window: {
      toolbarAria: "侧栏与工具区",
      hideSidebar: "隐藏侧栏",
      showSidebar: "展开侧栏",
      commitButton: "提交",
      collapseTools: "收拢工具区",
      expandTools: "展开工具区",
      settingsPlaceholderTitle: "桌面设置视图",
      settingsPlaceholderDescription: "保留设置页的首屏结构与层级。",
      marketplacePlaceholderTitle: "扩展市场视图",
      marketplacePlaceholderDescription: "保留市场页的首屏结构与层级。",
      previewEditorOnlyTextError: "仅为预览中的文本文件启用编辑器。",
      hostStatus: "Web Hero Preview",
      mcpReady: "MCP ready",
      newSession: "新会话",
    },
    commit: {
      modeCommit: "提交",
      modeCommitHint: "仅在本地创建一次提交。",
      modeCommitAndPush: "提交并推送",
      modeCommitAndPushHint: "提交后立即推送到当前分支远端。",
      title: "提交更改",
      currentBranch: (branch) => `当前分支：${branch || "main"}`,
      messageLabel: "提交信息",
      messagePlaceholder: "提交信息，为空将自动生成",
      modeLabel: "方式",
      modeAria: "提交方式",
      cancel: "取消",
      submitCommit: "提交",
      submitCommitAndPush: "提交并推送",
    },
    files: {
      noWorkspace: "连接工作区后显示文件树",
      fileListAria: "文件列表",
      planNotCreated: "计划尚未创建。create_plan 写入后，这里会显示 plans/ 下的计划文件。",
      unsavedCloseConfirm: "有未保存的更改，仍要关闭吗？",
      saveAria: "保存",
      saveShortcutTitle: "Ctrl+S / Cmd+S",
      closeAria: "关闭",
    },
    tools: {
      filesTab: "文件",
      shellTab: "终端",
      gitTab: "Git",
      browserTab: "浏览器",
      browserBack: "后退",
      browserForward: "前进",
      browserReload: "刷新",
      browserAddressBar: "地址栏",
      browserPickerToggle: "选择元素",
      resizeAria: "调整工具区宽度",
      panelAria: "工作区工具",
      tabListAria: "工具分页",
      gitChangesHeading: "变更",
      gitHistoryHeading: "历史",
      gitRefresh: "刷新",
      gitStageAll: "全部暂存",
    },
    shell: {
      helpTitle: "模拟 Shell 命令：",
      helpDir: "  dir / ls           查看预览工作区文件",
      helpTree: "  tree               输出工作区结构摘要",
      helpGitStatus: "  git status         查看模拟 Git 状态",
      helpBuild: "  npm run build      模拟站点构建",
      helpClear: "  clear / cls        清空终端",
      currentWorkspace: (workspaceRoot) => `当前工作区：${workspaceRoot}`,
      unsupportedCommand: (command) => `命令“${command}”不在当前预览支持范围内。`,
      typeHelp: "输入“help”查看模拟工作区。",
      noWorkspace: "打开工作区后可用。",
      retry: "重试",
      openSystemTerminal: "打开系统终端",
      exited: (exitCode) => `[已退出，代码 ${exitCode}]`,
    },
    previews: {
      siteReadmeDescription: "Spirit Agent 桌面产品的营销站预览。",
      desktopReadmeDescription: "桌面产品的 Electron 外壳与 Web 渲染器。",
      generatedWorkspaceDescription: (label) => `为落地页 ${label} 预览生成的模拟工作区。`,
      generatedWorkspaceOverview: (root) =>
        `工作区根路径：${root}\n\n这个模拟工作区让文件标签页可交互，同时不需要挂载完整桌面端运行时。`,
      heroSession: "Hero 桌面复刻",
      landingSession: "Landing 细节打磨",
      agentSession: "Hero 改版计划",
      designSession: "Hero 文案优化",
      desktopSession: "Electron 运行时对齐",
    },
  },
  docs: {
    search: "搜索",
    searchPlaceholder: "搜索文档",
    searchNoResults: "没有结果",
    onThisPage: "本页目录",
    openMenu: "打开文档菜单",
    closeMenu: "关闭文档菜单",
  },
};

export const messagesByLocale: Record<AppLocale, Messages> = {
  "en-US": enUS,
  "zh-CN": zhCN,
};
