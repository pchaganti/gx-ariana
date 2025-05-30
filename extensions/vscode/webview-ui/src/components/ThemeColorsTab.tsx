import React from 'react';

interface ColorSectionProps {
  title: string;
  colors: string[];
}

const ColorSection: React.FC<ColorSectionProps> = ({ title, colors }) => (
  <div className="mb-8 text-[var(--text-default)]">
    <h3 className="text-lg font-semibold mb-4">{title}</h3>
    <div className="flex flex-col gap-3">
      {colors.map((color) => (
        <div key={color} className="flex items-center gap-4">
          <div className="relative w-64 h-8 rounded-sm overflow-hidden">
            <div className="absolute inset-0 bg-[var(--surface-code)] opacity-50" />
            <div className="absolute inset-0" style={{ backgroundColor: `var(${color})` }} />
          </div>
          <code className="text-sm">{color}</code>
        </div>
      ))}
    </div>
  </div>
);

const ThemeColorsTab: React.FC = () => {
  const colorSections = [
    {
      title: "Surface Colors",
      colors: [
        "--surface-default",
        "--surface-raised",
        "--surface-overlay",
        "--surface-sunken",
        "--surface-code"
      ]
    },
    {
      title: "Interactive Colors",
      colors: [
        "--interactive-default",
        "--interactive-hover",
        "--interactive-active",
        "--interactive-muted"
      ]
    },
    {
      title: "Text Colors",
      colors: [
        "--text-default",
        "--text-muted",
        "--text-subtle",
        "--text-on-emphasis"
      ]
    },
    {
      title: "Status Colors",
      colors: [
        "--error-base",
        "--error-subtle",
        "--error-emphasis",
        "--warning-base",
        "--warning-subtle",
        "--warning-emphasis",
        "--info-base",
        "--info-subtle",
        "--info-emphasis",
        "--success-base",
        "--success-subtle",
        "--success-emphasis"
      ]
    }
  ];

  return (
    <div className="p-6 bg-[var(--surface-default)]">
      <div className="max-w-2xl space-y-8 overflow-auto max-h-[calc(100vh-50px)]">
        {colorSections.map((section) => (
          <ColorSection key={section.title} {...section} />
        ))}
      </div>
    </div>
  );
};

export default ThemeColorsTab;
