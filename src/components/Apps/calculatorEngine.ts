export type BinaryOperator = '+' | '-' | '×' | '÷';

export interface HistoryItem {
  id: string;
  expression: string;
  result: string;
}

export interface CalcState {
  display: string;
  expression: string;
  accumulator: number | null;
  pendingOperator: BinaryOperator | null;
  lastOperator: BinaryOperator | null;
  lastOperand: number | null;
  waitingForOperand: boolean;
  justEvaluated: boolean;
  error: string | null;
  memory: number[];
  history: HistoryItem[];
}

export const INITIAL_CALC_STATE: CalcState = {
  display: '0',
  expression: '',
  accumulator: null,
  pendingOperator: null,
  lastOperator: null,
  lastOperand: null,
  waitingForOperand: false,
  justEvaluated: false,
  error: null,
  memory: [],
  history: [],
};

export function formatNumberForDisplay(value: number): string {
  if (!Number.isFinite(value)) return 'Overflow';
  const normalized = Object.is(value, -0) ? 0 : value;
  const fixed = Number(normalized.toPrecision(15));
  const raw = String(fixed);
  if (raw.includes('e')) return raw;
  const [intPart, decPart] = raw.split('.');
  const formattedInt = Number(intPart).toLocaleString('en-US');
  return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
}

export function formatInputDisplay(rawInput: string): string {
  if (!rawInput || rawInput === '-') return '0';
  if (rawInput.includes('e')) return rawInput;
  const isNegative = rawInput.startsWith('-');
  const unsigned = isNegative ? rawInput.slice(1) : rawInput;
  const [intPart, decPart] = unsigned.split('.');
  const formattedInt = (intPart ? Number(intPart) : 0).toLocaleString('en-US');
  const prefix = isNegative ? '-' : '';
  return decPart !== undefined ? `${prefix}${formattedInt}.${decPart}` : `${prefix}${formattedInt}`;
}

export function parseDisplayNumber(display: string): number {
  return Number(display.replace(/,/g, ''));
}

function computeBinary(left: number, op: BinaryOperator, right: number): { value: number; error?: string } {
  switch (op) {
    case '+':
      return { value: left + right };
    case '-':
      return { value: left - right };
    case '×':
      return { value: left * right };
    case '÷':
      if (right === 0) {
        return {
          value: 0,
          error: left === 0 ? 'Result is undefined' : 'Cannot divide by zero',
        };
      }
      return { value: left / right };
  }
}

export function inputDigit(state: CalcState, digit: string): CalcState {
  if (state.error) {
    return { ...INITIAL_CALC_STATE, memory: state.memory, history: state.history, display: digit };
  }
  if (state.waitingForOperand || state.justEvaluated) {
    return {
      ...state,
      display: digit,
      expression: state.justEvaluated ? '' : state.expression,
      accumulator: state.justEvaluated ? null : state.accumulator,
      waitingForOperand: false,
      justEvaluated: false,
    };
  }
  const raw = state.display.replace(/,/g, '');
  if (raw.replace('-', '').replace('.', '').length >= 16) return state;
  const nextRaw = raw === '0' ? digit : `${raw}${digit}`;
  return {
    ...state,
    display: formatInputDisplay(nextRaw),
  };
}

export function inputDecimal(state: CalcState): CalcState {
  if (state.error) {
    return { ...INITIAL_CALC_STATE, memory: state.memory, history: state.history, display: '0.' };
  }
  if (state.waitingForOperand || state.justEvaluated) {
    return {
      ...state,
      display: '0.',
      expression: state.justEvaluated ? '' : state.expression,
      accumulator: state.justEvaluated ? null : state.accumulator,
      waitingForOperand: false,
      justEvaluated: false,
    };
  }
  if (state.display.includes('.')) return state;
  return {
    ...state,
    display: `${state.display}.`,
  };
}

export function toggleSign(state: CalcState): CalcState {
  if (state.error) return state;
  const current = parseDisplayNumber(state.display);
  if (current === 0) return state;
  return {
    ...state,
    display: formatNumberForDisplay(-current),
    waitingForOperand: false,
  };
}

export function backspace(state: CalcState): CalcState {
  if (state.error) {
    return { ...INITIAL_CALC_STATE, memory: state.memory, history: state.history };
  }
  if (state.waitingForOperand || state.justEvaluated) return state;
  const raw = state.display.replace(/,/g, '');
  if (raw.length <= 1 || (raw.length === 2 && raw.startsWith('-'))) {
    return { ...state, display: '0' };
  }
  const trimmed = raw.slice(0, -1);
  return {
    ...state,
    display: formatInputDisplay(trimmed.endsWith('.') ? trimmed.slice(0, -1) : trimmed),
  };
}

export function clearEntry(state: CalcState): CalcState {
  if (state.error) {
    return { ...INITIAL_CALC_STATE, memory: state.memory, history: state.history };
  }
  return {
    ...state,
    display: '0',
    waitingForOperand: false,
  };
}

export function clearAll(state: CalcState): CalcState {
  return {
    ...INITIAL_CALC_STATE,
    memory: state.memory,
    history: state.history,
  };
}

export function applyOperator(state: CalcState, op: BinaryOperator): CalcState {
  if (state.error) return state;
  const inputValue = parseDisplayNumber(state.display);

  if (state.accumulator === null || state.justEvaluated) {
    return {
      ...state,
      accumulator: inputValue,
      pendingOperator: op,
      expression: `${formatNumberForDisplay(inputValue)} ${op}`,
      waitingForOperand: true,
      justEvaluated: false,
    };
  }

  if (state.waitingForOperand) {
    return {
      ...state,
      pendingOperator: op,
      expression: `${formatNumberForDisplay(state.accumulator)} ${op}`,
    };
  }

  const activeOp = state.pendingOperator ?? op;
  const { value, error } = computeBinary(state.accumulator, activeOp, inputValue);
  if (error) {
    return {
      ...state,
      display: error,
      expression: `${formatNumberForDisplay(state.accumulator)} ${activeOp} ${formatNumberForDisplay(inputValue)}`,
      error,
      accumulator: null,
      pendingOperator: null,
      waitingForOperand: true,
    };
  }

  const formatted = formatNumberForDisplay(value);
  return {
    ...state,
    display: formatted,
    accumulator: value,
    pendingOperator: op,
    expression: `${formatted} ${op}`,
    waitingForOperand: true,
    justEvaluated: false,
  };
}

export function evaluateEquals(state: CalcState): CalcState {
  if (state.error) {
    return { ...INITIAL_CALC_STATE, memory: state.memory, history: state.history };
  }

  const currentVal = parseDisplayNumber(state.display);
  let left = state.accumulator;
  let op = state.pendingOperator;
  let right = currentVal;

  if (op === null) {
    if (state.lastOperator === null || state.lastOperand === null) {
      const formatted = formatNumberForDisplay(currentVal);
      return {
        ...state,
        display: formatted,
        expression: `${formatted} =`,
        justEvaluated: true,
        waitingForOperand: true,
      };
    }
    left = currentVal;
    op = state.lastOperator;
    right = state.lastOperand;
  }

  const leftVal = left ?? currentVal;
  const { value, error } = computeBinary(leftVal, op, right);
  const expr = `${formatNumberForDisplay(leftVal)} ${op} ${formatNumberForDisplay(right)} =`;

  if (error) {
    return {
      ...state,
      display: error,
      expression: expr,
      error,
      accumulator: null,
      pendingOperator: null,
      waitingForOperand: true,
      justEvaluated: true,
    };
  }

  const resultStr = formatNumberForDisplay(value);
  return {
    ...state,
    display: resultStr,
    expression: expr,
    accumulator: value,
    pendingOperator: null,
    lastOperator: op,
    lastOperand: right,
    waitingForOperand: true,
    justEvaluated: true,
    history: [
      { id: `${Date.now()}-${Math.random()}`, expression: expr, result: resultStr },
      ...state.history.slice(0, 29),
    ],
  };
}

export function applyUnary(
  state: CalcState,
  kind: 'percent' | 'reciprocal' | 'square' | 'sqrt',
): CalcState {
  if (state.error) return state;
  const current = parseDisplayNumber(state.display);

  if (kind === 'percent') {
    const base = state.accumulator ?? 0;
    const pct = state.pendingOperator ? (base * current) / 100 : 0;
    const formatted = formatNumberForDisplay(pct);
    return {
      ...state,
      display: formatted,
      expression: state.pendingOperator
        ? `${formatNumberForDisplay(base)} ${state.pendingOperator} ${formatted}`
        : formatted,
      waitingForOperand: false,
    };
  }

  if (kind === 'reciprocal') {
    if (current === 0) {
      return {
        ...state,
        display: 'Cannot divide by zero',
        expression: '1/(0)',
        error: 'Cannot divide by zero',
      };
    }
    const res = 1 / current;
    return {
      ...state,
      display: formatNumberForDisplay(res),
      expression: `1/(${formatNumberForDisplay(current)})`,
      waitingForOperand: true,
    };
  }

  if (kind === 'square') {
    const res = current * current;
    return {
      ...state,
      display: formatNumberForDisplay(res),
      expression: `sqr(${formatNumberForDisplay(current)})`,
      waitingForOperand: true,
    };
  }

  if (current < 0) {
    return {
      ...state,
      display: 'Invalid input',
      expression: `√(${formatNumberForDisplay(current)})`,
      error: 'Invalid input',
    };
  }
  const res = Math.sqrt(current);
  return {
    ...state,
    display: formatNumberForDisplay(res),
    expression: `√(${formatNumberForDisplay(current)})`,
    waitingForOperand: true,
  };
}
