import { useState } from 'react';
import type { FsNode } from '../../db/types';

interface WordHomeScreenProps {
  recentFiles: FsNode[];
  onNewBlank: () => void;
  onNewWelcome: () => void;
  onOpenFile: (fileId: string) => void;
  onOpenFromPc: () => void;
}

const TEMPLATES = [
  { id: 'blank', title: 'Blank document', preview: 'blank' },
  { id: 'welcome', title: 'Welcome to Word', preview: 'welcome' },
  { id: 'single', title: 'Single spaced (blank)', preview: 'blank' },
  { id: 'resume', title: 'Modern chronological resume', preview: 'resume' },
] as const;

export function WordHomeScreen({
  recentFiles,
  onNewBlank,
  onNewWelcome,
  onOpenFile,
  onOpenFromPc,
}: WordHomeScreenProps) {
  const [activeNav, setActiveNav] = useState<'home' | 'new' | 'open'>('home');
  const [recentTab, setRecentTab] = useState<'recent' | 'pinned'>('recent');

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div
      data-testid="word-home-screen"
      className="flex-1 flex bg-[#f3f2f1] text-[#262626] overflow-hidden select-none"
    >
      {/* Left Blue Word Sidebar */}
      <aside className="w-[104px] bg-[#2b579a] text-white flex flex-col justify-between shrink-0 py-3">
        <div className="flex flex-col">
          <div className="px-4 pb-3 text-[15px] font-semibold tracking-tight">
            Word
          </div>
          <button
            type="button"
            onClick={() => setActiveNav('home')}
            className={[
              'flex flex-col items-center justify-center py-3 px-2 text-[11px] gap-1 transition-colors cursor-default',
              activeNav === 'home' ? 'bg-[#1a3c70]' : 'hover:bg-white/10',
            ].join(' ')}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z" />
            </svg>
            <span>Home</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('new')}
            className={[
              'flex flex-col items-center justify-center py-3 px-2 text-[11px] gap-1 transition-colors cursor-default',
              activeNav === 'new' ? 'bg-[#1a3c70]' : 'hover:bg-white/10',
            ].join(' ')}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span>New</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveNav('open');
              onOpenFromPc();
            }}
            className={[
              'flex flex-col items-center justify-center py-3 px-2 text-[11px] gap-1 transition-colors cursor-default',
              activeNav === 'open' ? 'bg-[#1a3c70]' : 'hover:bg-white/10',
            ].join(' ')}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>Open</span>
          </button>
        </div>

        <div className="flex flex-col text-[11px] text-white/85 border-t border-white/15 pt-2">
          <button
            type="button"
            onClick={onOpenFromPc}
            className="py-2 px-3 text-center hover:bg-white/10 transition-colors cursor-default"
          >
            Account
          </button>
          <button
            type="button"
            onClick={onNewWelcome}
            className="py-2 px-3 text-center hover:bg-white/10 transition-colors cursor-default"
          >
            Feedback
          </button>
          <button
            type="button"
            onClick={onNewBlank}
            className="py-2 px-3 text-center hover:bg-white/10 transition-colors cursor-default"
          >
            Options
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-y-auto win10-scroll px-8 py-6 bg-[#f3f2f1]">
        <h1 className="text-[22px] font-semibold text-[#262626] mb-4">
          {greeting}
        </h1>

        {/* New Templates Row */}
        <div className="mb-6">
          <div className="text-[12px] font-semibold text-[#444444] mb-3 flex items-center gap-1.5">
            <span>New</span>
          </div>
          <div className="flex flex-wrap gap-4">
            {TEMPLATES.map((tpl, idx) => (
              <button
                key={tpl.id}
                type="button"
                data-testid={`word-template-${tpl.id}`}
                onClick={() => (tpl.id === 'welcome' ? onNewWelcome() : onNewBlank())}
                className="group flex flex-col items-start text-left w-[124px] cursor-default"
              >
                <div
                  className={[
                    'w-[124px] h-[160px] bg-white border transition-all flex flex-col p-3 shadow-xs group-hover:border-[#2b579a] group-hover:shadow-md',
                    idx === 0 ? 'border-[#2b579a] ring-1 ring-[#2b579a]/30' : 'border-[#d2d0ce]',
                  ].join(' ')}
                >
                  {tpl.preview === 'welcome' && (
                    <div className="mt-4 space-y-1.5">
                      <div className="text-[11px] font-semibold text-[#2b579a]">Take a tour</div>
                      <div className="h-1.5 w-16 bg-[#d2d0ce] rounded-xs" />
                      <div className="h-1.5 w-20 bg-[#edebe9] rounded-xs" />
                    </div>
                  )}
                  {tpl.preview === 'resume' && (
                    <div className="mt-2 space-y-1.5">
                      <div className="h-2 w-14 bg-[#c43e1c]/70 rounded-xs" />
                      <div className="h-1 w-20 bg-[#edebe9] rounded-xs" />
                      <div className="h-1 w-16 bg-[#edebe9] rounded-xs" />
                      <div className="h-1 w-18 bg-[#edebe9] rounded-xs" />
                    </div>
                  )}
                </div>
                <span className="mt-1.5 text-[11px] text-[#323130] leading-tight line-clamp-2">
                  {tpl.title}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent / Pinned Documents */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-6 border-b border-[#e1dfdd] mb-2">
            <button
              type="button"
              onClick={() => setRecentTab('recent')}
              className={[
                'pb-2 text-[13px] font-semibold border-b-2 transition-colors cursor-default',
                recentTab === 'recent'
                  ? 'border-[#2b579a] text-[#2b579a]'
                  : 'border-transparent text-[#605e5c] hover:text-[#262626]',
              ].join(' ')}
            >
              Recent
            </button>
            <button
              type="button"
              onClick={() => setRecentTab('pinned')}
              className={[
                'pb-2 text-[13px] font-semibold border-b-2 transition-colors cursor-default',
                recentTab === 'pinned'
                  ? 'border-[#2b579a] text-[#2b579a]'
                  : 'border-transparent text-[#605e5c] hover:text-[#262626]',
              ].join(' ')}
            >
              Pinned
            </button>
          </div>

          <div className="grid grid-cols-[1fr_140px] px-2 py-1.5 text-[11px] text-[#605e5c] border-b border-[#edebe9]">
            <span>Name</span>
            <span>Date modified</span>
          </div>

          {recentFiles.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-[#605e5c]">
              No recent Word documents yet. Click <strong>Blank document</strong> above to start writing, then click <strong>Save to Win 10</strong>.
            </div>
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
                    <img
                      src="/assets/icons/word.svg"
                      alt=""
                      className="w-5 h-5 object-contain shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium text-[#262626] truncate">
                        {file.name}
                      </div>
                      <div className="text-[10px] text-[#605e5c] truncate">
                        This PC &gt; Documents
                      </div>
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
