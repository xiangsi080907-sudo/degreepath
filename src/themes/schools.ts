export type SchoolTheme = {
  id: string;
  name: string;
  cssVariables: Record<`--${string}`, string>;
};

// Add a future institution here, then choose its theme from the active campus.
// The UI consumes these semantic CSS variables rather than school-specific hex values.
export const SCHOOL_THEMES = {
  "uw-seattle": {
    id: "uw-seattle",
    name: "University of Washington · Seattle",
    cssVariables: {
      "--school-primary": "#4B2E83",
      "--school-primary-dark": "#32006E",
      "--school-primary-soft": "#F1EDF7",
      "--school-secondary": "#B7A57A",
      "--school-secondary-soft": "#E8E3D3",
      "--school-accent": "#FFC700",
      "--school-background": "#F7F5FA",
      "--school-surface": "#FFFFFF",
      "--school-border": "#DED8E8",
      "--school-text": "#241434",
      "--school-text-muted": "#665C73",
      "--school-success": "#1E6B4E",
      "--school-warning": "#8A5B14",
      "--school-danger": "#9F2F2B",
    },
  },
} satisfies Record<string, SchoolTheme>;

export const activeSchoolTheme = SCHOOL_THEMES["uw-seattle"];
