// Maps URL-safe subfolder names to their human-readable display label
export const SUB_DISPLAY_NAMES: Record<string, string> = {
  'Vachnacht-Bris': 'Vachnacht + Bris',
};

export const CATEGORY_SUBS: Record<string, string[]> = {
  "It's a Boy":    ['Shulem Zucher', 'Vachnacht', 'Vachnacht-Bris', 'Bris', 'Pidyon Haben', "Shlishi L'milah"],
  "It's a Girl":   [],
  'Upsherin':      [],
  'Bar Mitzvah':   [],
  'Tenoyim':       [],
  'Vort':          [],
  'Wedding':       [],
  'Sheva Brachos': [],
};

// Maps folder names (that can't be auto-converted) to their display category name
export const FOLDER_TO_CATEGORY: Record<string, string> = {
  // Exact folder names as they exist on disk
  "It's a boy":    "It's a Boy",
  "It's a girl":   "It's a Girl",
  "Bar mitzva":    "Bar Mitzvah",
  // Hyphenated variants (kept for compatibility)
  "Its-a-Boy":     "It's a Boy",
  "Its-a-Girl":    "It's a Girl",
  "Bar-Mitzvah":   "Bar Mitzvah",
  "Sheva-Brachos": "Sheva Brachos",
};
