type ThemeAwareColor = {
  dark: string;
  light: string;
};

export const colors = {
  background: {
    primary: {
      dark: 'var(--surface-default)',
      light: 'var(--surface-default)'
    },
    secondary: {
      dark: 'var(--surface-raised)',
      light: 'var(--surface-raised)'
    },
    overlay: {
      dark: 'var(--surface-overlay)',
      light: 'var(--surface-overlay)'
    },
    sunken: {
      dark: 'var(--surface-sunken)',
      light: 'var(--surface-sunken)'
    },
    interactive: {
      default: {
        dark: 'var(--interactive-default)',
        light: 'var(--interactive-default)'
      },
      hover: {
        dark: 'var(--interactive-hover)',
        light: 'var(--interactive-hover)'
      },
      active: {
        dark: 'var(--interactive-active)',
        light: 'var(--interactive-active)'
      },
      muted: {
        dark: 'var(--interactive-muted)',
        light: 'var(--interactive-muted)'
      }
    }
  },
  text: {
    default: {
      dark: 'var(--text-default)',
      light: 'var(--text-default)'
    },
    muted: {
      dark: 'var(--text-muted)',
      light: 'var(--text-muted)'
    },
    subtle: {
      dark: 'var(--text-subtle)',
      light: 'var(--text-subtle)'
    },
    onEmphasis: {
      dark: 'var(--text-on-emphasis)',
      light: 'var(--text-on-emphasis)'
    }
  },
  border: {
    subtle: {
      dark: 'var(--border-subtle)',
      light: 'var(--border-subtle)'
    },
    default: {
      dark: 'var(--border-default)',
      light: 'var(--border-default)'
    },
    emphasis: {
      dark: 'var(--border-emphasis)',
      light: 'var(--border-emphasis)'
    }
  },
  status: {
    error: {
      default: {
        dark: 'var(--status-error)',
        light: 'var(--status-error)'
      },
      subtle: {
        dark: 'var(--status-error-subtle)',
        light: 'var(--status-error-subtle)'
      },
      emphasis: {
        dark: 'var(--status-error-emphasis)',
        light: 'var(--status-error-emphasis)'
      }
    }
  },
  link: {
    default: {
      dark: 'var(--link-base)',
      light: 'var(--link-base)'
    },
    hover: {
      dark: 'var(--link-hover)',
      light: 'var(--link-hover)'
    },
    active: {
      dark: 'var(--link-active)',
      light: 'var(--link-active)'
    }
  },
  focus: {
    ring: {
      dark: 'var(--focus-ring)',
      light: 'var(--focus-ring)'
    }
  },
  selection: {
    background: {
      dark: 'var(--selection-bg)',
      light: 'var(--selection-bg)'
    },
    foreground: {
      dark: 'var(--selection-fg)',
      light: 'var(--selection-fg)'
    }
  }
} as const;

export function getThemeAwareColor(color: ThemeAwareColor, isDark: boolean): string {
  return isDark ? color.dark : color.light;
}
