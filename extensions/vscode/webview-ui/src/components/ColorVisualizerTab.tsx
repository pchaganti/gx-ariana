import React, { useState } from 'react';

type ColorCategoryProps = {
  title: string;
  colors: string[];
};

const ColorCategory: React.FC<ColorCategoryProps> = ({ title, colors }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mb-6">
      <div 
        className="flex items-center justify-between p-2 bg-[var(--vscode-secondary-500)] cursor-pointer hover:bg-[var(--vscode-accent-500)] transition-colors rounded-sm group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-md font-semibold text-[var(--vscode-foreground)] group-hover:text-[var(--vscode-accent-foreground)]">{title}</h3>
        <div className="text-[var(--vscode-foreground)] group-hover:text-[var(--vscode-accent-foreground)]">
          {isExpanded ? '◉' : '◎'}
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-4 mt-2 bg-[var(--vscode-background)] rounded-md">
          <div className="flex flex-wrap gap-4 justify-start">
            {colors.map((color, index) => (
              <div key={index} className="flex flex-col items-center mb-4">
                <div 
                  className="w-16 h-16 rounded-md mb-2 border border-[var(--vscode-panel-border)]" 
                  style={{ backgroundColor: `var(${color})` }}
                />
                <div className="text-xs text-center break-all max-w-[120px]">{color}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ColorVisualizerTab: React.FC = () => {
  // Categories of colors
  const colorCategories = [
    {
      title: "Activity Bar",
      colors: [
        "--vscode-activityBar-background",
        "--vscode-activityBar-dropBorder",
        "--vscode-activityBar-foreground",
        "--vscode-activityBar-inactiveForeground",
        "--vscode-activityBar-border",
        "--vscode-activityBarBadge-background",
        "--vscode-activityBarBadge-foreground",
        "--vscode-activityBar-activeBorder",
        "--vscode-activityBar-activeBackground",
        "--vscode-activityBar-activeFocusBorder",
        "--vscode-activityBarTop-foreground",
        "--vscode-activityBarTop-activeBorder",
        "--vscode-activityBarTop-inactiveForeground",
        "--vscode-activityBarTop-dropBorder",
        "--vscode-activityBarTop-background",
        "--vscode-activityBarTop-activeBackground",
        "--vscode-activityWarningBadge-foreground",
        "--vscode-activityWarningBadge-background",
        "--vscode-activityErrorBadge-foreground",
        "--vscode-activityErrorBadge-background",
        "--vscode-profileBadge-background",
        "--vscode-profileBadge-foreground"
      ]
    },
    {
      title: "Sidebar",
      colors: [
        "--vscode-sideBar-background",
        "--vscode-sideBar-foreground",
        "--vscode-sideBar-border",
        "--vscode-sideBar-dropBackground",
        "--vscode-sideBarTitle-foreground",
        "--vscode-sideBarSectionHeader-background",
        "--vscode-sideBarSectionHeader-foreground",
        "--vscode-sideBarSectionHeader-border",
        "--vscode-sideBarActivityBarTop-border",
        "--vscode-sideBarTitle-background",
        "--vscode-sideBarTitle-border",
        "--vscode-sideBarStickyScroll-background",
        "--vscode-sideBarStickyScroll-border",
        "--vscode-sideBarStickyScroll-shadow",
        "--vscode-profiles-sashBorder"
      ]
    },
    {
      title: "Editor",
      colors: [
        "--vscode-editor-background",
        "--vscode-editor-foreground",
        "--vscode-editorLineNumber-foreground",
        "--vscode-editorLineNumber-activeForeground",
        "--vscode-editorLineNumber-dimmedForeground",
        "--vscode-editorCursor-background",
        "--vscode-editorCursor-foreground",
        "--vscode-editor-selectionBackground",
        "--vscode-editor-selectionForeground",
        "--vscode-editor-inactiveSelectionBackground",
        "--vscode-editor-selectionHighlightBackground",
        "--vscode-editor-selectionHighlightBorder",
        "--vscode-editor-wordHighlightBackground",
        "--vscode-editor-wordHighlightBorder",
        "--vscode-editor-findMatchBackground",
        "--vscode-editor-findMatchHighlightBackground",
        "--vscode-editor-lineHighlightBackground",
        "--vscode-editor-lineHighlightBorder",
        "--vscode-editorWhitespace-foreground",
        "--vscode-editorIndentGuide-background",
        "--vscode-editorIndentGuide-activeBackground"
      ]
    },
    {
      title: "Tabs",
      colors: [
        "--vscode-tab-activeBackground",
        "--vscode-tab-unfocusedActiveBackground",
        "--vscode-tab-activeForeground",
        "--vscode-tab-border",
        "--vscode-tab-activeBorder",
        "--vscode-tab-selectedBorderTop",
        "--vscode-tab-selectedBackground",
        "--vscode-tab-selectedForeground",
        "--vscode-tab-dragAndDropBorder",
        "--vscode-tab-unfocusedActiveBorder",
        "--vscode-tab-activeBorderTop",
        "--vscode-tab-unfocusedActiveBorderTop",
        "--vscode-tab-lastPinnedBorder",
        "--vscode-tab-inactiveBackground",
        "--vscode-tab-unfocusedInactiveBackground",
        "--vscode-tab-inactiveForeground",
        "--vscode-tab-unfocusedActiveForeground",
        "--vscode-tab-unfocusedInactiveForeground",
        "--vscode-tab-hoverBackground",
        "--vscode-tab-unfocusedHoverBackground",
        "--vscode-tab-hoverForeground",
        "--vscode-tab-unfocusedHoverForeground",
        "--vscode-tab-hoverBorder",
        "--vscode-tab-unfocusedHoverBorder",
        "--vscode-tab-activeModifiedBorder",
        "--vscode-tab-inactiveModifiedBorder",
        "--vscode-tab-unfocusedActiveModifiedBorder",
        "--vscode-tab-unfocusedInactiveModifiedBorder"
      ]
    },
    {
      title: "Buttons & Inputs",
      colors: [
        "--vscode-button-background",
        "--vscode-button-foreground",
        "--vscode-button-hoverBackground",
        "--vscode-button-secondaryBackground",
        "--vscode-button-secondaryForeground",
        "--vscode-button-secondaryHoverBackground",
        "--vscode-input-background",
        "--vscode-input-foreground",
        "--vscode-input-border",
        "--vscode-input-placeholderForeground",
        "--vscode-inputOption-activeBackground",
        "--vscode-inputOption-activeBorder",
        "--vscode-inputOption-activeForeground",
        "--vscode-inputOption-hoverBackground",
        "--vscode-inputValidation-errorBackground",
        "--vscode-inputValidation-errorForeground",
        "--vscode-inputValidation-errorBorder",
        "--vscode-inputValidation-infoBackground",
        "--vscode-inputValidation-infoForeground",
        "--vscode-inputValidation-infoBorder",
        "--vscode-inputValidation-warningBackground",
        "--vscode-inputValidation-warningForeground",
        "--vscode-inputValidation-warningBorder"
      ]
    },
    {
      title: "Dropdown & Lists",
      colors: [
        "--vscode-dropdown-background",
        "--vscode-dropdown-foreground",
        "--vscode-dropdown-border",
        "--vscode-dropdown-listBackground",
        "--vscode-list-activeSelectionBackground",
        "--vscode-list-activeSelectionForeground",
        "--vscode-list-hoverBackground",
        "--vscode-list-hoverForeground",
        "--vscode-list-inactiveSelectionBackground",
        "--vscode-list-inactiveSelectionForeground",
        "--vscode-list-focusBackground",
        "--vscode-list-focusForeground",
        "--vscode-list-highlightForeground",
        "--vscode-list-dropBackground",
        "--vscode-list-errorForeground",
        "--vscode-list-warningForeground",
        "--vscode-listFilterWidget-background",
        "--vscode-listFilterWidget-outline",
        "--vscode-listFilterWidget-noMatchesOutline",
        "--vscode-listFilterWidget-shadow",
        "--vscode-list-filterMatchBackground",
        "--vscode-list-filterMatchBorder",
        "--vscode-list-deemphasizedForeground",
        "--vscode-list-invalidItemForeground",
        "--vscode-list-focusOutline",
        "--vscode-list-hoverOutline",
        "--vscode-list-activeSelectionIconForeground",
        "--vscode-list-inactiveSelectionIconForeground",
        "--vscode-list-focusAndSelectionOutline",
        "--vscode-list-selectionOutline"
      ]
    },
    {
      title: "Status & Notifications",
      colors: [
        "--vscode-statusBar-background",
        "--vscode-statusBar-foreground",
        "--vscode-statusBar-border",
        "--vscode-statusBar-debuggingBackground",
        "--vscode-statusBar-debuggingForeground",
        "--vscode-statusBar-debuggingBorder",
        "--vscode-statusBar-noFolderForeground",
        "--vscode-statusBar-noFolderBackground",
        "--vscode-statusBar-noFolderBorder",
        "--vscode-statusBarItem-activeBackground",
        "--vscode-statusBarItem-hoverForeground",
        "--vscode-statusBarItem-hoverBackground",
        "--vscode-statusBarItem-prominentForeground",
        "--vscode-statusBarItem-prominentBackground",
        "--vscode-statusBarItem-prominentHoverForeground",
        "--vscode-statusBarItem-prominentHoverBackground",
        "--vscode-statusBarItem-remoteBackground",
        "--vscode-statusBarItem-remoteForeground",
        "--vscode-statusBarItem-remoteHoverBackground",
        "--vscode-statusBarItem-remoteHoverForeground",
        "--vscode-statusBarItem-errorBackground",
        "--vscode-statusBarItem-errorForeground",
        "--vscode-statusBarItem-errorHoverBackground",
        "--vscode-statusBarItem-errorHoverForeground",
        "--vscode-statusBarItem-warningBackground",
        "--vscode-statusBarItem-warningForeground",
        "--vscode-statusBarItem-warningHoverBackground",
        "--vscode-statusBarItem-warningHoverForeground",
        "--vscode-notifications-foreground",
        "--vscode-notifications-background",
        "--vscode-notifications-border",
        "--vscode-notificationLink-foreground",
        "--vscode-notificationsErrorIcon-foreground",
        "--vscode-notificationsWarningIcon-foreground",
        "--vscode-notificationsInfoIcon-foreground"
      ]
    },
    {
      title: "Terminal",
      colors: [
        "--vscode-terminal-background",
        "--vscode-terminal-border",
        "--vscode-terminal-foreground",
        "--vscode-terminal-ansiBlack",
        "--vscode-terminal-ansiBlue",
        "--vscode-terminal-ansiBrightBlack",
        "--vscode-terminal-ansiBrightBlue",
        "--vscode-terminal-ansiBrightCyan",
        "--vscode-terminal-ansiBrightGreen",
        "--vscode-terminal-ansiBrightMagenta",
        "--vscode-terminal-ansiBrightRed",
        "--vscode-terminal-ansiBrightWhite",
        "--vscode-terminal-ansiBrightYellow",
        "--vscode-terminal-ansiCyan",
        "--vscode-terminal-ansiGreen",
        "--vscode-terminal-ansiMagenta",
        "--vscode-terminal-ansiRed",
        "--vscode-terminal-ansiWhite",
        "--vscode-terminal-ansiYellow",
        "--vscode-terminal-selectionBackground",
        "--vscode-terminal-selectionForeground",
        "--vscode-terminal-inactiveSelectionBackground",
        "--vscode-terminal-findMatchBackground",
        "--vscode-terminal-findMatchBorder",
        "--vscode-terminal-findMatchHighlightBackground",
        "--vscode-terminal-findMatchHighlightBorder",
        "--vscode-terminal-hoverHighlightBackground",
        "--vscode-terminalCursor-background",
        "--vscode-terminalCursor-foreground"
      ]
    },
    {
      title: "Panel & Title Bar",
      colors: [
        "--vscode-panel-background",
        "--vscode-panel-border",
        "--vscode-panel-dropBorder",
        "--vscode-panelTitle-activeBorder",
        "--vscode-panelTitle-activeForeground",
        "--vscode-panelTitle-inactiveForeground",
        "--vscode-panelTitle-border",
        "--vscode-panelInput-border",
        "--vscode-panelSection-border",
        "--vscode-panelSection-dropBackground",
        "--vscode-panelSectionHeader-background",
        "--vscode-panelSectionHeader-foreground",
        "--vscode-panelSectionHeader-border",
        "--vscode-titleBar-activeBackground",
        "--vscode-titleBar-activeForeground",
        "--vscode-titleBar-inactiveBackground",
        "--vscode-titleBar-inactiveForeground",
        "--vscode-titleBar-border"
      ]
    },
    {
      title: "Scrollbars & Minimap",
      colors: [
        "--vscode-scrollbar-shadow",
        "--vscode-scrollbarSlider-background",
        "--vscode-scrollbarSlider-hoverBackground",
        "--vscode-scrollbarSlider-activeBackground",
        "--vscode-minimap-findMatchHighlight",
        "--vscode-minimap-selectionHighlight",
        "--vscode-minimap-errorHighlight",
        "--vscode-minimap-warningHighlight",
        "--vscode-minimap-background",
        "--vscode-minimap-selectionOccurrenceHighlight",
        "--vscode-minimap-foregroundOpacity",
        "--vscode-minimap-infoHighlight",
        "--vscode-minimap-chatEditHighlight",
        "--vscode-minimapSlider-background",
        "--vscode-minimapSlider-hoverBackground",
        "--vscode-minimapSlider-activeBackground",
        "--vscode-minimapGutter-addedBackground",
        "--vscode-minimapGutter-modifiedBackground",
        "--vscode-minimapGutter-deletedBackground"
      ]
    },
    {
      title: "Other UI Elements",
      colors: [
        "--vscode-focusBorder",
        "--vscode-foreground",
        "--vscode-disabledForeground",
        "--vscode-widget-shadow",
        "--vscode-widget-border",
        "--vscode-selection-background",
        "--vscode-descriptionForeground",
        "--vscode-errorForeground",
        "--vscode-icon-foreground",
        "--vscode-textBlockQuote-background",
        "--vscode-textBlockQuote-border",
        "--vscode-textCodeBlock-background",
        "--vscode-textLink-activeForeground",
        "--vscode-textLink-foreground",
        "--vscode-textPreformat-foreground",
        "--vscode-textSeparator-foreground",
        "--vscode-toolbar-hoverBackground",
        "--vscode-toolbar-activeBackground",
        "--vscode-banner-background",
        "--vscode-banner-foreground",
        "--vscode-banner-iconForeground",
        "--vscode-badge-background",
        "--vscode-badge-foreground"
      ]
    },
    {
      title: "Git & Source Control",
      colors: [
        "--vscode-gitDecoration-addedResourceForeground",
        "--vscode-gitDecoration-modifiedResourceForeground",
        "--vscode-gitDecoration-deletedResourceForeground",
        "--vscode-gitDecoration-renamedResourceForeground",
        "--vscode-gitDecoration-stageModifiedResourceForeground",
        "--vscode-gitDecoration-stageDeletedResourceForeground",
        "--vscode-gitDecoration-untrackedResourceForeground",
        "--vscode-gitDecoration-ignoredResourceForeground",
        "--vscode-gitDecoration-conflictingResourceForeground",
        "--vscode-gitDecoration-submoduleResourceForeground",
        "--vscode-git-blame-editorDecorationForeground"
      ]
    }
  ];

  return (
    <div className="p-4 overflow-auto h-full">
      <h2 className="text-lg font-semibold mb-4">VSCode Color Variables</h2>
      <p className="mb-6 text-sm">Click on a category to expand and see all color variables in that group.</p>
      
      {colorCategories.map((category, index) => (
        <ColorCategory key={index} title={category.title} colors={category.colors} />
      ))}
    </div>
  );
};

export default ColorVisualizerTab;
