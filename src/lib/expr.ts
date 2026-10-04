/**
 * Evaluate a simple arithmetic expression such as "55+75" or "2*80 + 5".
 * Supports + - * / and parentheses. Returns undefined for anything invalid.
 * Hand-written parser: never uses eval.
 */
export function evalExpr(src: string): number | undefined {
  const s = src.replace(/\s+/g, '').replace(/,/g, '.');
  if (!s || !/^[0-9.+\-*/()]+$/.test(s)) return undefined;
  let i = 0;

  const number = (): number | undefined => {
    const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
    if (!m) return undefined;
    i += m[0].length;
    return parseFloat(m[0]);
  };
  const factor = (): number | undefined => {
    if (s[i] === '-') {
      i++;
      const v = factor();
      return v === undefined ? undefined : -v;
    }
    if (s[i] === '+') {
      i++;
      return factor();
    }
    if (s[i] === '(') {
      i++;
      const v = expr();
      if (s[i] !== ')') return undefined;
      i++;
      return v;
    }
    return number();
  };
  const term = (): number | undefined => {
    let v = factor();
    while (v !== undefined && (s[i] === '*' || s[i] === '/')) {
      const op = s[i++];
      const r = factor();
      if (r === undefined) return undefined;
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  const expr = (): number | undefined => {
    let v = term();
    while (v !== undefined && (s[i] === '+' || s[i] === '-')) {
      const op = s[i++];
      const r = term();
      if (r === undefined) return undefined;
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };

  const v = expr();
  return i === s.length && v !== undefined && Number.isFinite(v) ? v : undefined;
}

/** True when the text is more than a plain number (worth showing "= result"). */
export const isExpression = (src: string) => /\d\s*[+\-*/]|[()]/.test(src.trim().replace(/^-/, ''));
