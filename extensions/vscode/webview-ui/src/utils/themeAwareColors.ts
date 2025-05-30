type ThemeAwareColor = {
  dark: string;
  light: string;
};

export const colors = {
  background: {
    primary: {
      dark: 'var(--vscode-editor-background)',
      light: 'var(--vscode-editor-background)'
    },
    secondary: {
      dark: 'var(--vscode-sideBar-background)',
      light: 'var(--vscode-sideBar-background)'
    },
    accent: {
      dark: 'var(--vscode-button-background)',
      light: 'var(--vscode-button-background)'
    }
  },
  text: {
    primary: {
      dark: 'var(--vscode-editor-foreground)',
      light: 'var(--vscode-editor-foreground)'
    },
    muted: {
      dark: 'var(--vscode-descriptionForeground)',
      light: 'var(--vscode-descriptionForeground)'
    },
    accent: {
      dark: 'var(--vscode-button-foreground)',
      light: 'var(--vscode-button-foreground)'
    }
  }
} as const;

export function getThemeAwareColor(color: ThemeAwareColor, isDark: boolean): string {
  return isDark ? color.dark : color.light;
}
