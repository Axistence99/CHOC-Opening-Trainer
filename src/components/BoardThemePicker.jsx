import { getAllBoardThemes } from '../data/boardThemes';

export default function BoardThemePicker({ currentTheme, onThemeChange, compact = false }) {
  const themes = getAllBoardThemes();

  if (compact) {
    // Compact mode: single row of clickable color swatches with tooltips
    return (
      <div className="space-y-1.5">
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Board Theme</h3>
        <div className="flex gap-1.5">
          {themes.map((theme) => {
            const isSelected = currentTheme === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => onThemeChange(theme.id)}
                title={theme.name}
                className={`relative w-7 h-7 rounded-md overflow-hidden transition-all ${
                  isSelected
                    ? 'ring-2 ring-violet-400 ring-offset-1 ring-offset-slate-800 scale-110'
                    : 'hover:scale-105 opacity-70 hover:opacity-100'
                }`}
              >
                {/* Mini checkerboard */}
                <div className="grid grid-cols-2 grid-rows-2 h-full w-full">
                  <div style={{ backgroundColor: theme.preview.light }} />
                  <div style={{ backgroundColor: theme.preview.dark }} />
                  <div style={{ backgroundColor: theme.preview.dark }} />
                  <div style={{ backgroundColor: theme.preview.light }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Full mode: grid with previews and labels
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-slate-400">Board Theme</h3>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {themes.map((theme) => {
          const isSelected = currentTheme === theme.id;
          return (
            <button
              key={theme.id}
              onClick={() => onThemeChange(theme.id)}
              className={`group relative rounded-lg p-2 transition-all ${
                isSelected
                  ? 'ring-2 ring-violet-500 ring-offset-1 ring-offset-slate-800 bg-slate-700/80'
                  : 'bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700 hover:border-slate-500'
              }`}
              title={theme.description}
            >
              {/* Mini board preview (2x2 squares) */}
              <div className="w-full aspect-square rounded overflow-hidden mb-1.5">
                <div className="grid grid-cols-2 grid-rows-2 h-full w-full">
                  <div style={{ backgroundColor: theme.preview.light }} />
                  <div style={{ backgroundColor: theme.preview.dark }} />
                  <div style={{ backgroundColor: theme.preview.dark }} />
                  <div style={{ backgroundColor: theme.preview.light }} />
                </div>
              </div>
              {/* Label */}
              <p className={`text-[10px] font-medium truncate ${
                isSelected ? 'text-violet-300' : 'text-slate-400 group-hover:text-slate-300'
              }`}>
                {theme.name}
              </p>
              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-violet-500 rounded-full flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
