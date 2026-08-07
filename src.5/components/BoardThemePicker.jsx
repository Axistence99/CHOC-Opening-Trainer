import { getAllBoardThemes } from '../data/boardThemes';

export default function BoardThemePicker({ currentTheme, onThemeChange, compact = false }) {
  const themes = getAllBoardThemes();

  if (compact) {
    return (
      <div className="space-y-1.5">
        <h3 className="font-orbitron font-semibold text-[10px]" style={{ color: 'rgba(150,142,130,0.5)', letterSpacing: '0.1em' }}>BOARD THEME</h3>
        <div className="flex gap-1.5">
          {themes.map((theme) => {
            const isSelected = currentTheme === theme.id;
            return (
              <button key={theme.id} onClick={() => onThemeChange(theme.id)} title={theme.name}
                className="relative w-7 h-7 rounded-md overflow-hidden transition-all"
                style={{
                  outline: isSelected ? '2px solid #6b8cae' : 'none',
                  outlineOffset: isSelected ? '2px' : '0',
                  opacity: isSelected ? 1 : 0.5,
                  transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                }}
              >
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

  return (
    <div className="space-y-2">
      <h3 className="font-orbitron font-semibold text-xs" style={{ color: '#8daac4', letterSpacing: '0.12em' }}>BOARD THEME</h3>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {themes.map((theme) => {
          const isSelected = currentTheme === theme.id;
          return (
            <button key={theme.id} onClick={() => onThemeChange(theme.id)} title={theme.description}
              className="group relative rounded-lg p-2 transition-all hover:scale-105"
              style={{
                background: isSelected ? 'rgba(107,140,174,0.12)' : 'rgba(15,20,40,0.6)',
                border: isSelected ? '1px solid rgba(107,140,174,0.35)' : '1px solid rgba(107,140,174,0.08)',
              }}
            >
              <div className="w-full aspect-square rounded overflow-hidden mb-1.5">
                <div className="grid grid-cols-2 grid-rows-2 h-full w-full">
                  <div style={{ backgroundColor: theme.preview.light }} />
                  <div style={{ backgroundColor: theme.preview.dark }} />
                  <div style={{ backgroundColor: theme.preview.dark }} />
                  <div style={{ backgroundColor: theme.preview.light }} />
                </div>
              </div>
              <p className="font-orbitron text-[9px] font-medium truncate" style={{ color: isSelected ? '#8daac4' : 'rgba(160,152,138,0.6)', letterSpacing: '0.05em' }}>{theme.name}</p>
              {isSelected && <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: '#6b8cae' }}><span className="text-white text-[8px]">✓</span></div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
