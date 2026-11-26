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
type CalcMode = 'standard' | 'scientific' | 'programmer';
type RadixBase = 16 | 10 | 8 | 2;
type BitwiseOp = 'AND' | 'OR' | 'XOR' | 'LSH' | 'RSH' | null;

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n) || n > 170) return NaN;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

export function CalculatorApp({ isActive }: CalculatorAppProps) {
  const [calc, setCalc] = useState<CalcState>(INITIAL_CALC_STATE);
  const [panel, setPanel] = useState<OverlayPanel>('none');
  const [mode, setMode] = useState<CalcMode>('standard');
  const [navOpen, setNavOpen] = useState(false);

  // Scientific state
  const [sciSecond, setSciSecond] = useState(false);
  const [sciPendingPow, setSciPendingPow] = useState<number | null>(null);

  // Programmer state
  const [radix, setRadix] = useState<RadixBase>(10);
  const [progValue, setProgValue] = useState<number>(0);
  const [progAcc, setProgAcc] = useState<number | null>(null);
  const [progOp, setProgOp] = useState<BitwiseOp>(null);
  const [progWaiting, setProgWaiting] = useState<boolean>(false);

  const hasMemory = calc.memory.length > 0;

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (mode === 'programmer') {
        const up = e.key.toUpperCase();
        if (/^[0-9A-F]$/.test(up)) {
          const digitVal = parseInt(up, 16);
          if (digitVal < radix) {
            e.preventDefault();
            handleProgDigit(up);
          }
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          handleProgBackspace();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setProgValue(0);
          setProgAcc(null);
          setProgOp(null);
        } else if (e.key === 'Enter' || e.key === '=') {
          e.preventDefault();
          handleProgEquals();
        }
        return;
      }

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
        handleMainEquals();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setCalc((s) => backspace(s));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSciPendingPow(null);
        setCalc((s) => clearAll(s));
      } else if (e.key === 'Delete') {
        e.preventDefault();
        setCalc((s) => clearEntry(s));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, mode, radix, progValue, progAcc, progOp, progWaiting, sciPendingPow]);

  const handleMainEquals = () => {
    if (sciPendingPow !== null) {
      const exp = parseDisplayNumber(calc.display);
      const res = Math.pow(sciPendingPow, exp);
      const formatted = Number.isFinite(res) ? formatNumberForDisplay(res) : 'Overflow';
      const expr = `${sciPendingPow} ^ ${exp} =`;
      setSciPendingPow(null);
      setCalc((s) => ({
        ...s,
        display: formatted,
        expression: expr,
        justEvaluated: true,
        waitingForOperand: true,
        error: Number.isFinite(res) ? null : 'Overflow',
        history: Number.isFinite(res)
          ? [{ id: String(Date.now()), expression: expr, result: formatted }, ...s.history].slice(0, 30)
          : s.history,
      }));
      return;
    }
    setCalc((s) => evaluateEquals(s));
  };

  const applyScientificFn = (fn: string) => {
    const val = parseDisplayNumber(calc.display);
    let res = val;
    let label = `${fn}(${calc.display})`;

    if (fn === 'pi') {
      setCalc((s) => ({ ...s, display: String(Number(Math.PI.toFixed(10))), waitingForOperand: false, error: null }));
      return;
    }
    if (fn === 'e') {
      setCalc((s) => ({ ...s, display: String(Number(Math.E.toFixed(10))), waitingForOperand: false, error: null }));
      return;
    }
    if (fn === 'pow') {
      setSciPendingPow(val);
      setCalc((s) => ({ ...s, expression: `${calc.display} ^`, waitingForOperand: true }));
      return;
    }

    switch (fn) {
      case 'sin': res = Math.sin((val * Math.PI) / 180); break;
      case 'cos': res = Math.cos((val * Math.PI) / 180); break;
      case 'tan': res = Math.tan((val * Math.PI) / 180); break;
      case 'abs': res = Math.abs(val); label = `abs(${calc.display})`; break;
      case 'cube': res = val ** 3; label = `cube(${calc.display})`; break;
      case 'tenPow': res = 10 ** val; label = `10^(${calc.display})`; break;
      case 'log': res = Math.log10(val); break;
      case 'ln': res = Math.log(val); break;
      case 'fact': res = factorial(val); label = `fact(${calc.display})`; break;
      case 'exp': res = Math.exp(val); label = `e^(${calc.display})`; break;
      default: break;
    }

    if (!Number.isFinite(res) || Number.isNaN(res)) {
      setCalc((s) => ({ ...s, display: 'Invalid input', error: 'Invalid input', waitingForOperand: true }));
      return;
    }
    const formatted = formatNumberForDisplay(Number(res.toPrecision(12)));
    setCalc((s) => ({
      ...s,
      display: formatted,
      expression: label,
      justEvaluated: true,
      waitingForOperand: true,
      error: null,
      history: [{ id: String(Date.now()), expression: `${label} =`, result: formatted }, ...s.history].slice(0, 30),
    }));
  };

  // Programmer handlers
  const handleProgDigit = (d: string) => {
    const str = progWaiting ? '' : progValue === 0 ? '' : progValue.toString(radix).toUpperCase();
    const nextStr = `${str}${d}`;
    const parsed = parseInt(nextStr, radix);
    if (!Number.isFinite(parsed)) return;
    setProgValue(parsed | 0);
    setProgWaiting(false);
  };

  const handleProgBackspace = () => {
    const str = progValue.toString(radix);
    if (str.length <= 1) setProgValue(0);
    else setProgValue(parseInt(str.slice(0, -1), radix) | 0);
  };

  const applyBitOp = (op: BitwiseOp) => {
    if (progAcc !== null && progOp && !progWaiting) {
      handleProgEquals();
    }
    setProgAcc(progValue);
    setProgOp(op);
    setProgWaiting(true);
  };

  const handleProgEquals = () => {
    if (progAcc === null || !progOp) return;
    let res = progValue;
    if (progOp === 'AND') res = progAcc & progValue;
    else if (progOp === 'OR') res = progAcc | progValue;
    else if (progOp === 'XOR') res = progAcc ^ progValue;
    else if (progOp === 'LSH') res = progAcc << progValue;
    else if (progOp === 'RSH') res = progAcc >> progValue;
    setProgValue(res);
    setProgAcc(null);
    setProgOp(null);
    setProgWaiting(true);
  };

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
      const nextMemory = s.memory.length === 0 ? [updated] : [updated, ...s.memory.slice(1)];
      return { ...s, memory: nextMemory, waitingForOperand: true };
    });
  };

  const displayText =
    mode === 'programmer'
      ? (progValue >>> 0).toString(radix).toUpperCase()
      : calc.display;

  const displayFontSize = calc.error
    ? 'text-[26px] leading-[32px]'
    : displayText.length > 13
      ? 'text-[28px] leading-[34px]'
      : displayText.length > 10
        ? 'text-[36px] leading-[42px]'
        : 'text-[44px] leading-[50px]';

  const opBtnClass =
    'flex items-center justify-center rounded-[2px] bg-[#323232] hover:bg-[#3f3f3f] active:bg-[#2c2c2c] text-white text-[14px] font-normal transition-colors cursor-default disabled:opacity-35';
  const numBtnClass =
    'flex items-center justify-center rounded-[2px] bg-[#3b3b3b] hover:bg-[#484848] active:bg-[#333333] text-white text-[17px] font-semibold transition-colors cursor-default disabled:opacity-30';
  const memBtnClass = (enabled: boolean) =>
    [
      'flex items-center justify-center h-[30px] text-[12px] font-semibold rounded-[2px] transition-colors cursor-default',
      enabled ? 'text-white hover:bg-white/10 active:bg-white/15' : 'text-[#6c6c6c]',
    ].join(' ');

  const modeLabel = mode === 'standard' ? 'Standard' : mode === 'scientific' ? 'Scientific' : 'Programmer';

  return (
    <div className="relative flex flex-col flex-1 bg-[#202020] text-white overflow-hidden select-none">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between h-[44px] px-1 shrink-0 relative z-30">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setNavOpen((v) => !v)}
            className="flex items-center justify-center w-10 h-10 hover:bg-white/10 transition-colors cursor-default"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
              <line x1="2" y1="4" x2="14" y2="4" />
              <line x1="2" y1="8" x2="14" y2="8" />
              <line x1="2" y1="12" x2="14" y2="12" />
            </svg>
          </button>
          <span className="text-[20px] font-semibold tracking-tight px-1">{modeLabel}</span>
        </div>

        {mode !== 'programmer' && (
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
        )}

        {/* Mode Drawer */}
        {navOpen && (
          <div className="absolute left-0 top-[44px] w-[200px] bg-[#2a2a2a] border border-white/15 shadow-2xl py-2 z-40">
            <div className="px-4 py-1 text-[11px] font-semibold text-white/55">Calculator</div>
            {(
              [
                { id: 'standard', label: 'Standard' },
                { id: 'scientific', label: 'Scientific' },
                { id: 'programmer', label: 'Programmer' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setMode(item.id);
                  setNavOpen(false);
                  setPanel('none');
                }}
                className={`w-full text-left px-4 py-2 text-[13px] flex items-center justify-between cursor-default ${
                  mode === item.id ? 'bg-white/15 font-semibold' : 'hover:bg-white/10'
                }`}
              >
                <span>{item.label}</span>
                {mode === item.id && <span className="text-[#76b9ed]">•</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Display */}
      <div className="flex flex-col items-end justify-end px-4 pt-1 pb-2 min-h-[94px] shrink-0">
        <div data-testid="calc-expression" className="text-[13px] leading-[18px] text-[#a4a4a4] min-h-[18px] truncate max-w-full">
          {mode === 'programmer' ? (progOp ? `${progAcc} ${progOp}` : '') : calc.expression}
        </div>
        <div data-testid="calc-display" className={`font-semibold tracking-tight text-right truncate max-w-full mt-1 tabular-nums ${displayFontSize}`}>
          {displayText}
        </div>
      </div>

      {mode === 'programmer' ? (
        <>
          {/* Multi-base Radix Panel */}
          <div className="px-2 pb-2 space-y-0.5 text-[12px] shrink-0">
            {(
              [
                { base: 16, label: 'HEX' },
                { base: 10, label: 'DEC' },
                { base: 8, label: 'OCT' },
                { base: 2, label: 'BIN' },
              ] as const
            ).map((r) => {
              const formatted = (progValue >>> 0).toString(r.base).toUpperCase();
              const active = radix === r.base;
              return (
                <button
                  key={r.base}
                  type="button"
                  onClick={() => setRadix(r.base)}
                  className={`w-full flex items-center gap-3 px-2 py-1 text-left cursor-default border-l-2 ${
                    active ? 'border-[#76b9ed] bg-white/10 font-semibold' : 'border-transparent hover:bg-white/5 text-white/75'
                  }`}
                >
                  <span className="w-8">{r.label}</span>
                  <span className="truncate font-mono">{formatted}</span>
                </button>
              );
            })}
          </div>

          {/* Programmer Keypad */}
          <div className="grid grid-cols-5 grid-rows-6 gap-[3px] p-[4px] flex-1 min-h-0">
            <button type="button" onClick={() => applyBitOp('AND')} className={opBtnClass}>AND</button>
            <button type="button" onClick={() => applyBitOp('OR')} className={opBtnClass}>OR</button>
            <button type="button" onClick={() => applyBitOp('XOR')} className={opBtnClass}>XOR</button>
            <button type="button" onClick={() => setProgValue((v) => ~v)} className={opBtnClass}>NOT</button>
            <button type="button" onClick={() => { setProgValue(0); setProgAcc(null); setProgOp(null); }} className={opBtnClass}>C</button>

            <button type="button" disabled={radix !== 16} onClick={() => handleProgDigit('A')} className={numBtnClass}>A</button>
            <button type="button" onClick={() => applyBitOp('LSH')} className={opBtnClass}>≪</button>
            <button type="button" onClick={() => applyBitOp('RSH')} className={opBtnClass}>≫</button>
            <button type="button" onClick={() => setProgValue(0)} className={opBtnClass}>CE</button>
            <button type="button" onClick={handleProgBackspace} className={opBtnClass}>⌫</button>

            <button type="button" disabled={radix !== 16} onClick={() => handleProgDigit('B')} className={numBtnClass}>B</button>
            <button type="button" disabled={radix < 8} onClick={() => handleProgDigit('7')} className={numBtnClass}>7</button>
            <button type="button" disabled={radix < 10} onClick={() => handleProgDigit('8')} className={numBtnClass}>8</button>
            <button type="button" disabled={radix < 10} onClick={() => handleProgDigit('9')} className={numBtnClass}>9</button>
            <button type="button" disabled={radix !== 16} onClick={() => handleProgDigit('F')} className={numBtnClass}>F</button>

            <button type="button" disabled={radix !== 16} onClick={() => handleProgDigit('C')} className={numBtnClass}>C</button>
            <button type="button" disabled={radix < 8} onClick={() => handleProgDigit('4')} className={numBtnClass}>4</button>
            <button type="button" disabled={radix < 8} onClick={() => handleProgDigit('5')} className={numBtnClass}>5</button>
            <button type="button" disabled={radix < 8} onClick={() => handleProgDigit('6')} className={numBtnClass}>6</button>
            <button type="button" disabled={radix !== 16} onClick={() => handleProgDigit('E')} className={numBtnClass}>E</button>

            <button type="button" disabled={radix !== 16} onClick={() => handleProgDigit('D')} className={numBtnClass}>D</button>
            <button type="button" onClick={() => handleProgDigit('1')} className={numBtnClass}>1</button>
            <button type="button" disabled={radix < 8} onClick={() => handleProgDigit('2')} className={numBtnClass}>2</button>
            <button type="button" disabled={radix < 8} onClick={() => handleProgDigit('3')} className={numBtnClass}>3</button>
            <button type="button" onClick={() => setProgValue((v) => -v)} className={opBtnClass}>+/−</button>

            <span />
            <button type="button" onClick={() => handleProgDigit('0')} className={`${numBtnClass} col-span-2`}>0</button>
            <span />
            <button type="button" onClick={handleProgEquals} className="flex items-center justify-center rounded-[2px] bg-[#76b9ed] hover:bg-[#6ab0e7] text-[#111] text-[20px] cursor-default">=</button>
          </div>
        </>
      ) : (
        <>
          {/* Memory Row */}
          <div className="grid grid-cols-6 gap-0.5 px-1 pb-1 shrink-0">
            <button type="button" disabled={!hasMemory} onClick={() => handleMemoryAction('MC')} className={memBtnClass(hasMemory)}>MC</button>
            <button type="button" disabled={!hasMemory} onClick={() => handleMemoryAction('MR')} className={memBtnClass(hasMemory)}>MR</button>
            <button type="button" onClick={() => handleMemoryAction('M+')} className={memBtnClass(true)}>M+</button>
            <button type="button" onClick={() => handleMemoryAction('M-')} className={memBtnClass(true)}>M−</button>
            <button type="button" onClick={() => handleMemoryAction('MS')} className={memBtnClass(true)}>MS</button>
            <button type="button" disabled={!hasMemory} onClick={() => setPanel((p) => (p === 'memory' ? 'none' : 'memory'))} className={memBtnClass(hasMemory)}>M▾</button>
          </div>

          {mode === 'scientific' ? (
            /* Scientific 5x7 Keypad */
            <div className="grid grid-cols-5 grid-rows-7 gap-[3px] p-[4px] flex-1 min-h-0">
              <button type="button" onClick={() => setSciSecond((v) => !v)} className={`${opBtnClass} ${sciSecond ? 'bg-[#76b9ed] text-[#111]' : ''}`}>2nd</button>
              <button type="button" onClick={() => applyScientificFn('pi')} className={opBtnClass}>π</button>
              <button type="button" onClick={() => applyScientificFn('e')} className={opBtnClass}>e</button>
              <button type="button" onClick={() => { setSciPendingPow(null); setCalc((s) => clearAll(s)); }} className={opBtnClass}>C</button>
              <button type="button" onClick={() => setCalc((s) => backspace(s))} className={opBtnClass}>⌫</button>

              <button type="button" onClick={() => setCalc((s) => applyUnary(s, 'square'))} className={opBtnClass}>{sciSecond ? 'x³' : 'x²'}</button>
              <button type="button" onClick={() => setCalc((s) => applyUnary(s, 'reciprocal'))} className={opBtnClass}>1/x</button>
              <button type="button" onClick={() => applyScientificFn('abs')} className={opBtnClass}>|x|</button>
              <button type="button" onClick={() => applyScientificFn('exp')} className={opBtnClass}>exp</button>
              <button type="button" onClick={() => applyScientificFn('sin')} className={opBtnClass}>sin</button>

              <button type="button" onClick={() => setCalc((s) => applyUnary(s, 'sqrt'))} className={opBtnClass}>²√x</button>
              <button type="button" onClick={() => applyScientificFn('cos')} className={opBtnClass}>cos</button>
              <button type="button" onClick={() => applyScientificFn('tan')} className={opBtnClass}>tan</button>
              <button type="button" onClick={() => applyScientificFn('fact')} className={opBtnClass}>n!</button>
              <button type="button" onClick={() => setCalc((s) => applyOperator(s, '÷'))} className={`${opBtnClass} text-[18px]`}>÷</button>

              <button type="button" onClick={() => applyScientificFn('pow')} className={opBtnClass}>xʸ</button>
              <button type="button" onClick={() => setCalc((s) => inputDigit(s, '7'))} className={numBtnClass}>7</button>
              <button type="button" onClick={() => setCalc((s) => inputDigit(s, '8'))} className={numBtnClass}>8</button>
              <button type="button" onClick={() => setCalc((s) => inputDigit(s, '9'))} className={numBtnClass}>9</button>
              <button type="button" onClick={() => setCalc((s) => applyOperator(s, '×'))} className={`${opBtnClass} text-[18px]`}>×</button>

              <button type="button" onClick={() => applyScientificFn('tenPow')} className={opBtnClass}>10ˣ</button>
              <button type="button" onClick={() => setCalc((s) => inputDigit(s, '4'))} className={numBtnClass}>4</button>
              <button type="button" onClick={() => setCalc((s) => inputDigit(s, '5'))} className={numBtnClass}>5</button>
              <button type="button" onClick={() => setCalc((s) => inputDigit(s, '6'))} className={numBtnClass}>6</button>
              <button type="button" onClick={() => setCalc((s) => applyOperator(s, '-'))} className={`${opBtnClass} text-[18px]`}>−</button>

              <button type="button" onClick={() => applyScientificFn('log')} className={opBtnClass}>log</button>
              <button type="button" onClick={() => setCalc((s) => inputDigit(s, '1'))} className={numBtnClass}>1</button>
              <button type="button" onClick={() => setCalc((s) => inputDigit(s, '2'))} className={numBtnClass}>2</button>
              <button type="button" onClick={() => setCalc((s) => inputDigit(s, '3'))} className={numBtnClass}>3</button>
              <button type="button" onClick={() => setCalc((s) => applyOperator(s, '+'))} className={`${opBtnClass} text-[18px]`}>+</button>

              <button type="button" onClick={() => applyScientificFn('ln')} className={opBtnClass}>ln</button>
              <button type="button" onClick={() => setCalc((s) => toggleSign(s))} className={`${numBtnClass} text-[14px]`}>+/−</button>
              <button type="button" onClick={() => setCalc((s) => inputDigit(s, '0'))} className={numBtnClass}>0</button>
              <button type="button" onClick={() => setCalc((s) => inputDecimal(s))} className={numBtnClass}>.</button>
              <button type="button" onClick={handleMainEquals} className="flex items-center justify-center rounded-[2px] bg-[#76b9ed] hover:bg-[#6ab0e7] text-[#111] text-[20px] cursor-default">=</button>
            </div>
          ) : (
            /* Standard 4x6 Keypad */
            <div className="grid grid-cols-4 grid-rows-6 gap-[3px] p-[4px] flex-1 min-h-0">
              <button type="button" onClick={() => setCalc((s) => applyUnary(s, 'percent'))} className={opBtnClass}>%</button>
              <button type="button" onClick={() => setCalc((s) => clearEntry(s))} className={`${opBtnClass} text-[14px]`}>CE</button>
              <button type="button" onClick={() => setCalc((s) => clearAll(s))} className={`${opBtnClass} text-[14px]`}>C</button>
              <button type="button" aria-label="Backspace" onClick={() => setCalc((s) => backspace(s))} className={opBtnClass}>⌫</button>

              <button type="button" onClick={() => setCalc((s) => applyUnary(s, 'reciprocal'))} className={`${opBtnClass} text-[14px] italic`}>1/x</button>
              <button type="button" onClick={() => setCalc((s) => applyUnary(s, 'square'))} className={`${opBtnClass} text-[14px] italic`}>x²</button>
              <button type="button" onClick={() => setCalc((s) => applyUnary(s, 'sqrt'))} className={`${opBtnClass} text-[14px]`}>²√x</button>
              <button type="button" aria-label="Divide" onClick={() => setCalc((s) => applyOperator(s, '÷'))} className={`${opBtnClass} text-[20px]`}>÷</button>

              <button type="button" onClick={() => setCalc((s) => inputDigit(s, '7'))} className={numBtnClass}>7</button>
              <button type="button" onClick={() => setCalc((s) => inputDigit(s, '8'))} className={numBtnClass}>8</button>
              <button type="button" onClick={() => setCalc((s) => inputDigit(s, '9'))} className={numBtnClass}>9</button>
              <button type="button" aria-label="Multiply" onClick={() => setCalc((s) => applyOperator(s, '×'))} className={`${opBtnClass} text-[20px]`}>×</button>

              <button type="button" onClick={() => setCalc((s) => inputDigit(s, '4'))} className={numBtnClass}>4</button>
              <button type="button" onClick={() => setCalc((s) => inputDigit(s, '5'))} className={numBtnClass}>5</button>
              <button type="button" onClick={() => setCalc((s) => inputDigit(s, '6'))} className={numBtnClass}>6</button>
              <button type="button" aria-label="Subtract" onClick={() => setCalc((s) => applyOperator(s, '-'))} className={`${opBtnClass} text-[20px]`}>−</button>

              <button type="button" onClick={() => setCalc((s) => inputDigit(s, '1'))} className={numBtnClass}>1</button>
              <button type="button" onClick={() => setCalc((s) => inputDigit(s, '2'))} className={numBtnClass}>2</button>
              <button type="button" onClick={() => setCalc((s) => inputDigit(s, '3'))} className={numBtnClass}>3</button>
              <button type="button" aria-label="Add" onClick={() => setCalc((s) => applyOperator(s, '+'))} className={`${opBtnClass} text-[20px]`}>+</button>

              <button type="button" aria-label="Negate" onClick={() => setCalc((s) => toggleSign(s))} className={`${numBtnClass} text-[15px] font-normal`}>+/−</button>
              <button type="button" onClick={() => setCalc((s) => inputDigit(s, '0'))} className={numBtnClass}>0</button>
              <button type="button" onClick={() => setCalc((s) => inputDecimal(s))} className={numBtnClass}>.</button>
              <button type="button" aria-label="Equals" onClick={handleMainEquals} className="flex items-center justify-center rounded-[2px] bg-[#76b9ed] hover:bg-[#6ab0e7] active:bg-[#5ca3dc] text-[#111111] text-[22px] font-normal transition-colors cursor-default">=</button>
            </div>
          )}
        </>
      )}

      {/* History / Memory Flyout Drawer */}
      {panel !== 'none' && (
        <div className="absolute inset-x-0 bottom-0 top-[148px] bg-[#242424]/98 border-t border-white/10 flex flex-col justify-between p-3 z-20">
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
                  if (panel === 'history') setCalc((s) => ({ ...s, history: [] }));
                  else {
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
