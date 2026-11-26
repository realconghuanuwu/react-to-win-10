import {
  DEFAULT_TASKBAR_SETTINGS,
  useDesktopStore,
  type TaskbarSettings,
} from '../../store/useDesktopStore';
import type {
  TaskbarCombineMode,
  TaskbarLocation,
  TaskbarSearchMode,
} from '../../db/types';

function Win10Toggle({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  description?: string;
}) {
  return (
    <div className="py-2">
      <div className="text-[13.5px] text-white/95 leading-snug mb-2">{label}</div>
      {description && <div className="text-[12px] text-white/60 mb-2">{description}</div>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          onClick={() => onChange(!checked)}
          className={[
            'relative w-[44px] h-[20px] rounded-full border transition-colors cursor-default shrink-0',
            checked
              ? 'bg-[#0078d7] border-[#0078d7]'
              : 'bg-transparent border-white/70 hover:border-white',
          ].join(' ')}
        >
          <span
            className={[
              'absolute top-[3px] w-[12px] h-[12px] rounded-full transition-all',
              checked ? 'left-[26px] bg-white' : 'left-[4px] bg-white/85',
            ].join(' ')}
          />
        </button>
        <span className="text-[13px] text-white/90">{checked ? 'On' : 'Off'}</span>
      </div>
    </div>
  );
}

const SIDEBAR_ITEMS = [
  'Background',
  'Colors',
  'Lock screen',
  'Themes',
  'Fonts',
  'Start',
  'Taskbar',
] as const;

export function TaskbarSettingsApp() {
  const settings = useDesktopStore((state) => state.taskbarSettings);
  const updateTaskbarSettings = useDesktopStore((state) => state.updateTaskbarSettings);

  const selectClass =
    'w-[260px] max-w-full h-[32px] px-2.5 bg-[#1f1f1f] border border-[#666666] hover:border-[#999999] text-[13px] text-white outline-none cursor-default';

  const setSystemIcon = (key: keyof TaskbarSettings['systemIcons'], value: boolean) => {
    updateTaskbarSettings((prev) => ({
      ...prev,
      systemIcons: { ...prev.systemIcons, [key]: value },
    }));
  };

  return (
    <div className="flex flex-1 min-h-0 bg-[#141414] text-white select-none">
      {/* Left Navigation Pane */}
      <aside className="w-[210px] shrink-0 bg-[#1f1f1f] border-r border-white/10 flex flex-col py-3">
        <div className="px-4 pb-3 text-[12px] font-semibold text-white/60 uppercase tracking-wider">
          Personalization
        </div>
        <nav className="flex flex-col">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = item === 'Taskbar';
            return (
              <div
                key={item}
                className={[
                  'relative flex items-center h-[38px] px-4 text-[13.5px] transition-colors',
                  isActive
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-white/65 hover:bg-white/5',
                ].join(' ')}
              >
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-[#0078d7]" />
                )}
                <span>{item}</span>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <section className="flex-1 overflow-y-auto px-7 py-6 space-y-6">
        <div>
          <h1 className="text-[26px] font-light text-white tracking-tight">Taskbar</h1>
          <p className="text-[12.5px] text-white/60 mt-1">
            Customize the Windows 10 taskbar layout, buttons, and notification area. All changes are saved automatically in IndexedDB.
          </p>
        </div>

        <div className="space-y-3 max-w-[560px]">
          <Win10Toggle
            label="Lock the taskbar"
            checked={settings.locked}
            onChange={(locked) => updateTaskbarSettings({ locked })}
          />

          <Win10Toggle
            label="Automatically hide the taskbar in desktop mode"
            checked={settings.autoHide}
            onChange={(autoHide) => updateTaskbarSettings({ autoHide })}
          />

          <Win10Toggle
            label="Use small taskbar buttons"
            checked={settings.smallButtons}
            onChange={(smallButtons) => updateTaskbarSettings({ smallButtons })}
          />

          <Win10Toggle
            label="Use Peek to preview the desktop when you move your mouse to the Show desktop button at the end of the taskbar"
            checked={settings.usePeek}
            onChange={(usePeek) => updateTaskbarSettings({ usePeek })}
          />

          <Win10Toggle
            label="Show badges on taskbar buttons"
            checked={settings.showBadges}
            onChange={(showBadges) => updateTaskbarSettings({ showBadges })}
          />

          <div className="pt-2">
            <label className="block text-[13.5px] text-white/95 mb-2" htmlFor="taskbar-location-select">
              Taskbar location on screen
            </label>
            <select
              id="taskbar-location-select"
              value={settings.location}
              onChange={(e) =>
                updateTaskbarSettings({ location: e.target.value as TaskbarLocation })
              }
              className={selectClass}
            >
              <option value="bottom">Bottom</option>
              <option value="top">Top</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </div>

          <div className="pt-2">
            <label className="block text-[13.5px] text-white/95 mb-2" htmlFor="taskbar-combine-select">
              Combine taskbar buttons
            </label>
            <select
              id="taskbar-combine-select"
              value={settings.combineButtons}
              onChange={(e) =>
                updateTaskbarSettings({ combineButtons: e.target.value as TaskbarCombineMode })
              }
              className={selectClass}
            >
              <option value="always">Always, hide labels</option>
              <option value="when-full">When taskbar is full</option>
              <option value="never">Never</option>
            </select>
          </div>

          <div className="pt-2">
            <label className="block text-[13.5px] text-white/95 mb-2" htmlFor="taskbar-search-select">
              Search on the taskbar
            </label>
            <select
              id="taskbar-search-select"
              value={settings.searchMode}
              onChange={(e) =>
                updateTaskbarSettings({ searchMode: e.target.value as TaskbarSearchMode })
              }
              className={selectClass}
            >
              <option value="hidden">Hidden</option>
              <option value="icon">Show search icon</option>
              <option value="box">Show search box</option>
            </select>
          </div>
        </div>

        <div className="pt-4 border-t border-white/10 max-w-[560px]">
          <h2 className="text-[18px] font-light text-white mb-2">Taskbar items</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <Win10Toggle
              label="Cortana button"
              checked={settings.showCortana}
              onChange={(showCortana) => updateTaskbarSettings({ showCortana })}
            />
            <Win10Toggle
              label="Task View button"
              checked={settings.showTaskView}
              onChange={(showTaskView) => updateTaskbarSettings({ showTaskView })}
            />
            <Win10Toggle
              label="People button"
              checked={settings.showPeople}
              onChange={(showPeople) => updateTaskbarSettings({ showPeople })}
            />
            <Win10Toggle
              label="Windows Ink Workspace"
              checked={settings.showInkWorkspace}
              onChange={(showInkWorkspace) => updateTaskbarSettings({ showInkWorkspace })}
            />
            <Win10Toggle
              label="Touch keyboard button"
              checked={settings.showTouchKeyboard}
              onChange={(showTouchKeyboard) => updateTaskbarSettings({ showTouchKeyboard })}
            />
          </div>
        </div>

        <div className="pt-4 border-t border-white/10 max-w-[560px]">
          <h2 className="text-[18px] font-light text-white mb-2">
            Notification area (System icons)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <Win10Toggle
              label="Clock"
              checked={settings.systemIcons.clock}
              onChange={(v) => setSystemIcon('clock', v)}
            />
            <Win10Toggle
              label="Volume"
              checked={settings.systemIcons.volume}
              onChange={(v) => setSystemIcon('volume', v)}
            />
            <Win10Toggle
              label="Network"
              checked={settings.systemIcons.network}
              onChange={(v) => setSystemIcon('network', v)}
            />
            <Win10Toggle
              label="Action Center"
              checked={settings.systemIcons.actionCenter}
              onChange={(v) => setSystemIcon('actionCenter', v)}
            />
          </div>
        </div>

        <div className="pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={() => updateTaskbarSettings(DEFAULT_TASKBAR_SETTINGS)}
            className="px-4 py-1.5 bg-[#333333] hover:bg-[#444444] active:bg-[#555555] text-[13px] text-white border border-white/15 cursor-default"
          >
            Reset taskbar settings to default
          </button>
        </div>
      </section>
    </div>
  );
}
