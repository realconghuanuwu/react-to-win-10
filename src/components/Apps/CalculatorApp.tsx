import { useEffect, useState } from 'react';
import {
  INITIAL_CALC_STATE,
  applyOperator,
  applyUnary,
  backspace,
  clearAll,
  clearEntry,
  evaluateEquals,
  formatNumberForDisplay,
  inputDecimal,
  inputDigit,
  parseDisplayNumber,
  toggleSign,
  type CalcState,
} from './calculatorEngine';

interface CalculatorAppProps {
  isActive: boolean;
}

type OverlayPanel = 'none' | 'history' | 'memory';

export function CalculatorApp({ isActive }: CalculatorAppProps) {
  const [calc, setCalc] = useState<CalcState>(INITIAL_CALC_STATE);
  const [panel, setPanel] = useState<OverlayPanel>('none');

  const hasMemory = calc.memory.length > 0;

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        setCalc((s) => inputDigit(s, e.key));
      } else if (e.key === '.') {
        e.preventDefault();
        setCalc((s) => inputDecimal(s));
      } else if (e.key === '+') {
        e.preventDefault();
        setCalc((s) => applyOperator(s, '+'));
      } else if (e.key === '-') {
        e.preventDefault();
        setCalc((s) => applyOperator(s, '-'));
      } else if (e.key === '*') {
        e.preventDefault();
        setCalc((s) => applyOperator(s, '×'));
      } else if (e.key === '/') {
        e.preventDefault();
        setCalc((s) => applyOperator(s, '÷'));
      } else if (e.key === '%') {
        e.preventDefault();
        setCalc((s) => applyUnary(s, 'percent'));
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        setCalc((s) => evaluateEquals(s));
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setCalc((s) => backspace(s));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setCalc((s) => clearAll(s));
      } else if (e.key === 'Delete') {
        e.preventDefault();
        setCalc((s) => clearEntry(s));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);

  const handleMemoryAction = (action: 'MC' | 'MR' | 'M+' | 'M-' | 'MS') => {
    if (calc.error) return;
    const current = parseDisplayNumber(calc.display);

    if (action === 'MC') {
      setCalc((s) => ({ ...s, memory: [] }));
      if (panel === 'memory') setPanel('none');
      return;
    }
    if (action === 'MR') {
      if (!hasMemory) return;
      setCalc((s) => ({
        ...s,
        display: formatNumberForDisplay(s.memory[0]),
        waitingForOperand: true,
      }));
      return;
    }
    if (action === 'MS') {
      setCalc((s) => ({
        ...s,
        memory: [current, ...s.memory],
        waitingForOperand: true,
      }));
      return;
    }
    setCalc((s) => {
      const top = s.memory[0] ?? 0;
      const updated = action === 'M+' ? top + current : top - current;
      const nextMemory =
        s.memory.length === 0 ? [updated] : [updated, ...s.memory.slice(1)];
      return { ...s, memory: nextMemory, waitingForOperand: true };
    });
  };

  const displayFontSize = calc.error
    ? 'text-[26px] leading-[32px]'
    : calc.display.length > 13
      ? 'text-[30px] leading-[36px]'
      : calc.display.length > 10
        ? 'text-[38px] leading-[44px]'
        : 'text-[46px] leading-[52px]';

  const opBtnClass =
    'flex items-center justify-center rounded-[2px] bg-[#323232] hover:bg-[#3f3f3f] active:bg-[#2c2c2c] text-white text-[16px] font-normal transition-colors cursor-default';
  const numBtnClass =
    'flex items-center justify-center rounded-[2px] bg-[#3b3b3b] hover:bg-[#484848] active:bg-[#333333] text-white text-[19px] font-semibold transition-colors cursor-default';

  const memBtnClass = (enabled: boolean) =>
    [
      'flex items-center justify-center h-[32px] text-[12px] font-semibold rounded-[2px] transition-colors cursor-default',
      enabled
        ? 'text-white hover:bg-white/10 active:bg-white/15'
        : 'text-[#6c6c6c]',
    ].join(' ');

  return (
    <div className="relative flex flex-col flex-1 bg-[#202020] text-white overflow-hidden select-none">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between h-[44px] px-1 shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Open navigation"
            className="flex items-center justify-center w-10 h-10 hover:bg-white/10 transition-colors cursor-default"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
              <line x1="2" y1="4" x2="14" y2="4" />
              <line x1="2" y1="8" x2="14" y2="8" />
              <line x1="2" y1="12" x2="14" y2="12" />
            </svg>
          </button>
          <span className="text-[20px] font-semibold tracking-tight px-1">Standard</span>
          <button
            type="button"
            aria-label="Keep on top"
            className="flex items-center justify-center w-8 h-8 ml-1 hover:bg-white/10 transition-colors cursor-default text-white/85"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
              <rect x="2.5" y="2.5" width="11" height="11" rx="1" />
              <rect x="3" y="8" width="5" height="5" fill="currentColor" stroke="none" />
              <polyline points="8.5,4.5 11.5,4.5 11.5,7.5" />
              <line x1="11.5" y1="4.5" x2="7.5" y2="8.5" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          aria-label="History"
          onClick={() => setPanel((p) => (p === 'history' ? 'none' : 'history'))}
          className={[
            'flex items-center justify-center w-10 h-10 hover:bg-white/10 transition-colors cursor-default',
            panel === 'history' ? 'bg-white/12' : '',
          ].join(' ')}
        >
          <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
            <path d="M3.2 7.5A6 6 0 1 1 4.8 13.3" strokeLinecap="round" />
            <polyline points="2.5,4.5 2.8,7.8 6,7.5" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="9,5.5 9,9.3 11.8,10.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Display */}
      <div className="flex flex-col items-end justify-end px-4 pt-2 pb-3 min-h-[104px] shrink-0">
        <div
          data-testid="calc-expression"
          className="text-[13px] leading-[18px] text-[#a4a4a4] min-h-[18px] truncate max-w-full"
        >
          {calc.expression}
        </div>
        <div
          data-testid="calc-display"
          className={`font-semibold tracking-tight text-right truncate max-w-full mt-1 tabular-nums ${displayFontSize}`}
        >
          {calc.display}
        </div>
      </div>

      {/* Memory Row */}
      <div className="grid grid-cols-6 gap-0.5 px-1 pb-1 shrink-0">
        <button
          type="button"
          disabled={!hasMemory}
          onClick={() => handleMemoryAction('MC')}
          className={memBtnClass(hasMemory)}
        >
          MC
        </button>
        <button
          type="button"
          disabled={!hasMemory}
          onClick={() => handleMemoryAction('MR')}
          className={memBtnClass(hasMemory)}
        >
          MR
        </button>
        <button
          type="button"
          onClick={() => handleMemoryAction('M+')}
          className={memBtnClass(true)}
        >
          M+
        </button>
        <button
          type="button"
          onClick={() => handleMemoryAction('M-')}
          className={memBtnClass(true)}
        >
          M−
        </button>
        <button
          type="button"
          onClick={() => handleMemoryAction('MS')}
          className={memBtnClass(true)}
        >
          MS
        </button>
        <button
          type="button"
          disabled={!hasMemory}
          onClick={() => setPanel((p) => (p === 'memory' ? 'none' : 'memory'))}
          className={memBtnClass(hasMemory)}
        >
          M▾
        </button>
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-4 grid-rows-6 gap-[3px] p-[4px] flex-1 min-h-0">
        {/* Row 1 */}
        <button type="button" onClick={() => setCalc((s) => applyUnary(s, 'percent'))} className={opBtnClass}>
          %
        </button>
        <button type="button" onClick={() => setCalc((s) => clearEntry(s))} className={`${opBtnClass} text-[14px]`}>
          CE
        </button>
        <button type="button" onClick={() => setCalc((s) => clearAll(s))} className={`${opBtnClass} text-[14px]`}>
          C
        </button>
        <button
          type="button"
          aria-label="Backspace"
          onClick={() => setCalc((s) => backspace(s))}
          className={opBtnClass}
        >
          <svg viewBox="0 0 20 14" width="18" height="13" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true">
            <path d="M6.5 1.5H18.5V12.5H6.5L1.5 7L6.5 1.5Z" strokeLinejoin="round" />
            <line x1="9.5" y1="4.5" x2="14.5" y2="9.5" />
            <line x1="14.5" y1="4.5" x2="9.5" y2="9.5" />
          </svg>
        </button>

        {/* Row 2 */}
        <button type="button" onClick={() => setCalc((s) => applyUnary(s, 'reciprocal'))} className={`${opBtnClass} text-[14px] italic`}>
          1/x
        </button>
        <button type="button" onClick={() => setCalc((s) => applyUnary(s, 'square'))} className={`${opBtnClass} text-[14px] italic`}>
          x²
        </button>
        <button type="button" onClick={() => setCalc((s) => applyUnary(s, 'sqrt'))} className={`${opBtnClass} text-[14px]`}>
          ²√x
        </button>
        <button
          type="button"
          aria-label="Divide"
          onClick={() => setCalc((s) => applyOperator(s, '÷'))}
          className={`${opBtnClass} text-[20px]`}
        >
          ÷
        </button>

        {/* Row 3 */}
        <button type="button" onClick={() => setCalc((s) => inputDigit(s, '7'))} className={numBtnClass}>
          7
        </button>
        <button type="button" onClick={() => setCalc((s) => inputDigit(s, '8'))} className={numBtnClass}>
          8
        </button>
        <button type="button" onClick={() => setCalc((s) => inputDigit(s, '9'))} className={numBtnClass}>
          9
        </button>
        <button
          type="button"
          aria-label="Multiply"
          onClick={() => setCalc((s) => applyOperator(s, '×'))}
          className={`${opBtnClass} text-[20px]`}
        >
          ×
        </button>

        {/* Row 4 */}
        <button type="button" onClick={() => setCalc((s) => inputDigit(s, '4'))} className={numBtnClass}>
          4
        </button>
        <button type="button" onClick={() => setCalc((s) => inputDigit(s, '5'))} className={numBtnClass}>
          5
        </button>
        <button type="button" onClick={() => setCalc((s) => inputDigit(s, '6'))} className={numBtnClass}>
          6
        </button>
        <button
          type="button"
          aria-label="Subtract"
          onClick={() => setCalc((s) => applyOperator(s, '-'))}
          className={`${opBtnClass} text-[20px]`}
        >
          −
        </button>

        {/* Row 5 */}
        <button type="button" onClick={() => setCalc((s) => inputDigit(s, '1'))} className={numBtnClass}>
          1
        </button>
        <button type="button" onClick={() => setCalc((s) => inputDigit(s, '2'))} className={numBtnClass}>
          2
        </button>
        <button type="button" onClick={() => setCalc((s) => inputDigit(s, '3'))} className={numBtnClass}>
          3
        </button>
        <button
          type="button"
          aria-label="Add"
          onClick={() => setCalc((s) => applyOperator(s, '+'))}
          className={`${opBtnClass} text-[20px]`}
        >
          +
        </button>

        {/* Row 6 */}
        <button
          type="button"
          aria-label="Negate"
          onClick={() => setCalc((s) => toggleSign(s))}
          className={`${numBtnClass} text-[15px] font-normal`}
        >
          +/−
        </button>
        <button type="button" onClick={() => setCalc((s) => inputDigit(s, '0'))} className={numBtnClass}>
          0
        </button>
        <button type="button" onClick={() => setCalc((s) => inputDecimal(s))} className={numBtnClass}>
          .
        </button>
        <button
          type="button"
          aria-label="Equals"
          onClick={() => setCalc((s) => evaluateEquals(s))}
          className="flex items-center justify-center rounded-[2px] bg-[#76b9ed] hover:bg-[#6ab0e7] active:bg-[#5ca3dc] text-[#111111] text-[22px] font-normal transition-colors cursor-default"
        >
          =
        </button>
      </div>

      {/* History / Memory Flyout Drawer */}
      {panel !== 'none' && (
        <div
          className="absolute inset-x-0 bottom-0 top-[148px] bg-[#242424]/98 border-t border-white/10 flex flex-col justify-between p-3 z-20"
        >
          <div className="overflow-y-auto flex-1 space-y-2 pr-1">
            {panel === 'history' ? (
              calc.history.length === 0 ? (
                <p className="text-[13px] text-white/70 pt-2">There&apos;s no history yet.</p>
              ) : (
                calc.history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setCalc((s) => ({
                        ...s,
                        display: item.result,
                        expression: item.expression,
                        justEvaluated: true,
                        waitingForOperand: true,
                        error: null,
                      }));
                      setPanel('none');
                    }}
                    className="w-full text-right px-2 py-1.5 hover:bg-white/10 rounded-[2px] cursor-default"
                  >
                    <div className="text-[12px] text-white/60">{item.expression}</div>
                    <div className="text-[18px] font-semibold text-white tabular-nums">{item.result}</div>
                  </button>
                ))
              )
            ) : calc.memory.length === 0 ? (
              <p className="text-[13px] text-white/70 pt-2">There&apos;s nothing saved in memory.</p>
            ) : (
              calc.memory.map((val, idx) => (
                <button
                  key={`${idx}-${val}`}
                  type="button"
                  onClick={() => {
                    setCalc((s) => ({
                      ...s,
                      display: formatNumberForDisplay(val),
                      waitingForOperand: true,
                    }));
                    setPanel('none');
                  }}
                  className="w-full text-right px-2 py-1.5 hover:bg-white/10 rounded-[2px] text-[18px] font-semibold text-white tabular-nums cursor-default"
                >
                  {formatNumberForDisplay(val)}
                </button>
              ))
            )}
          </div>

          {((panel === 'history' && calc.history.length > 0) ||
            (panel === 'memory' && calc.memory.length > 0)) && (
            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                type="button"
                aria-label={panel === 'history' ? 'Clear history' : 'Clear memory'}
                onClick={() => {
                  if (panel === 'history') {
                    setCalc((s) => ({ ...s, history: [] }));
                  } else {
                    setCalc((s) => ({ ...s, memory: [] }));
                    setPanel('none');
                  }
                }}
                className="px-2.5 py-1 text-[12px] text-white/85 hover:bg-white/10 cursor-default"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
