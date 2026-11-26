import { useState } from 'react';
import type { FsNode } from '../../db/types';

interface OfficeHomeScreenProps {
  mode: 'word' | 'excel';
  recentFiles: FsNode[];
  onNewBlank: () => void;
  onOpenFile: (fileId: string) => void;
  onOpenFromPc: () => void;
}

export function OfficeHomeScreen({
  mode,
  recentFiles,
  onNewBlank,
  onOpenFile,
  onOpenFromPc,
}: OfficeHomeScreenProps) {
  const [activeNav, setActiveNav] = useState<'home' | 'new' | 'open'>('home');
  const [recentTab, setRecentTab] = useState<'recent' | 'pinned'>('recent');

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const isWord = mode === 'word';
  const brandColor = isWord ? '#2b579a' : '#107c41';
  const brandHoverBg = isWord ? 'hover:bg-[#1a3c70]' : 'hover:bg-[#0c6434]';
  const activeBg = isWord ? 'bg-[#1a3c70]' : 'bg-[#0c6434]';
  const accentText = isWord ? 'text-[#2b579a]' : 'text-[#107c41]';
  const accentBorder = isWord ? 'border-[#2b579a] ring-[#2b579a]/30' : 'border-[#107c41] ring-[#107c41]/30';
  const accentTabBorder = isWord ? 'border-[#2b579a] text-[#2b579a]' : 'border-[#107c41] text-[#107c41]';

  const appLabel = isWord ? 'Word' : 'Excel';
  const templateLabel = isWord ? 'Blank document' : 'Blank workbook';
  const fileIcon = isWord ? '/assets/icons/word.svg' : '/assets/icons/excel.svg';
  const emptyHint = isWord
    ? 'No recent Word documents yet. Click Blank document above to start writing, then click Save to Win 10.'
    : 'No recent Excel workbooks yet. Click Blank workbook above to start, then click Save to Win 10.';
  const testId = isWord ? 'word-home-screen' : 'excel-home-screen';
  const templateTestId = isWord ? 'word-template-blank' : 'excel-template-blank';

  return (
    <div
      data-testid={testId}
      className="flex-1 flex text-[#262626] overflow-hidden select-none"
      style={{ background: '#f3f2f1' }}
    >
      {/* Left Sidebar */}
      <aside
        className="w-[104px] text-white flex flex-col justify-between shrink-0 py-3"
        style={{ backgroundColor: brandColor }}
      >
        <div className="flex flex-col">
          <div className="px-4 pb-3 text-[15px] font-semibold tracking-tight">
            {appLabel}
          </div>

          {/* Home */}
          <button
            type="button"
            onClick={() => setActiveNav('home')}
            className={[
              'flex flex-col items-center justify-center py-3 px-2 text-[11px] gap-1 transition-colors cursor-default',
              activeNav === 'home' ? activeBg : brandHoverBg,
            ].join(' ')}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z" />
            </svg>
            <span>Home</span>
          </button>

          {/* New */}
          <button
            type="button"
            onClick={() => { setActiveNav('new'); onNewBlank(); }}
            className={[
              'flex flex-col items-center justify-center py-3 px-2 text-[11px] gap-1 transition-colors cursor-default',
              activeNav === 'new' ? activeBg : brandHoverBg,
            ].join(' ')}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span>New</span>
          </button>

          {/* Open */}
          <button
            type="button"
            onClick={() => { setActiveNav('open'); onOpenFromPc(); }}
            className={[
              'flex flex-col items-center justify-center py-3 px-2 text-[11px] gap-1 transition-colors cursor-default',
              activeNav === 'open' ? activeBg : brandHoverBg,
            ].join(' ')}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>Open</span>
          </button>
        </div>

        {/* Footer */}
        <div className="flex flex-col text-[11px] text-white/85 border-t border-white/15 pt-2">
          <button type="button" className={`py-2 px-3 text-center transition-colors cursor-default ${brandHoverBg}`}>
            Account
          </button>
          <button type="button" className={`py-2 px-3 text-center transition-colors cursor-default ${brandHoverBg}`}>
            Feedback
          </button>
          <button type="button" className={`py-2 px-3 text-center transition-colors cursor-default ${brandHoverBg}`}>
            Options
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-y-auto win10-scroll px-8 py-6 bg-[#f3f2f1]">
        <h1 className="text-[22px] font-semibold text-[#262626] mb-4">{greeting}</h1>

        {/* New Templates Row — only Blank */}
        <div className="mb-6">
          <div className="text-[12px] font-semibold text-[#444444] mb-3">New</div>
          <div className="flex gap-4">
            <button
              type="button"
              data-testid={templateTestId}
              onClick={onNewBlank}
              className="group flex flex-col items-start text-left w-[124px] cursor-default"
            >
              <div
                className={`w-[124px] h-[160px] bg-white border transition-all flex flex-col items-center justify-center shadow-xs group-hover:border-current group-hover:shadow-md ${accentBorder} ring-1`}
                style={{ borderColor: brandColor }}
              >
                {isWord ? (
                  /* Word blank page preview */
                  <div className="w-14 h-[72px] bg-white border border-[#d2d0ce] shadow-sm flex flex-col p-1.5 gap-1">
                    <div className="h-1 w-10 bg-[#edebe9] rounded-xs" />
                    <div className="h-1 w-8 bg-[#edebe9] rounded-xs" />
                    <div className="h-1 w-10 bg-[#edebe9] rounded-xs" />
                  </div>
                ) : (
                  /* Excel blank grid preview */
                  <div className="w-14 h-[72px] bg-white border border-[#d2d0ce] shadow-sm overflow-hidden">
                    <div className="grid grid-cols-3 h-full">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="border-r border-b border-[#e1dfdd]" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <span className={`mt-1.5 text-[11px] font-medium leading-tight ${accentText}`}>
                {templateLabel}
              </span>
            </button>
          </div>
        </div>

        {/* Recent / Pinned */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-6 border-b border-[#e1dfdd] mb-2">
            <button
              type="button"
              onClick={() => setRecentTab('recent')}
              className={[
                'pb-2 text-[13px] font-semibold border-b-2 transition-colors cursor-default',
                recentTab === 'recent' ? accentTabBorder : 'border-transparent text-[#605e5c] hover:text-[#262626]',
              ].join(' ')}
            >
              Recent
            </button>
            <button
              type="button"
              onClick={() => setRecentTab('pinned')}
              className={[
                'pb-2 text-[13px] font-semibold border-b-2 transition-colors cursor-default',
                recentTab === 'pinned' ? accentTabBorder : 'border-transparent text-[#605e5c] hover:text-[#262626]',
              ].join(' ')}
            >
              Pinned
            </button>
          </div>

          <div className="grid grid-cols-[1fr_140px] px-2 py-1.5 text-[11px] text-[#605e5c] border-b border-[#edebe9]">
            <span>Name</span>
            <span>Date modified</span>
          </div>

          {recentTab === 'pinned' ? (
            <div className="py-8 text-center text-[12px] text-[#605e5c]">
              No pinned {isWord ? 'documents' : 'workbooks'}.
            </div>
          ) : recentFiles.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-[#605e5c]">{emptyHint}</div>
          ) : (
            <div className="divide-y divide-[#edebe9]">
              {recentFiles.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => onOpenFile(file.id)}
                  className="w-full grid grid-cols-[1fr_140px] items-center px-2 py-2.5 hover:bg-[#e1dfdd]/60 text-left transition-colors cursor-default"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <img src={fileIcon} alt="" className="w-5 h-5 object-contain shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium text-[#262626] truncate">{file.name}</div>
                      <div className="text-[10px] text-[#605e5c] truncate">This PC &gt; Documents</div>
                    </div>
                  </div>
                  <span className="text-[11px] text-[#605e5c]">
                    {new Date(file.modifiedAt).toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
