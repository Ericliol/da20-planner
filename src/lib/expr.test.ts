import { describe, expect, it } from 'vitest';
import { evalExpr, isExpression } from './expr';

describe('evalExpr', () => {
  it.each([
    ['55+75', 130],
    ['55 + 75 + 10', 140],
    ['2*80+5', 165],
    ['(60+70)/2', 65],
    ['91-2-30', 59],
    ['-5', -5],
    ['72.5', 72.5],
    ['3,5', 3.5],
    ['10.', 10],
  ])('%s = %d', (src, v) => expect(evalExpr(src)).toBeCloseTo(v));

  it.each(['55+', 'abc', '1+(2', 'alert(1)', '5/0', ''])('rejects %j', (src) => expect(evalExpr(src)).toBeUndefined());

  it('detects expressions', () => {
    expect(isExpression('55+75')).toBe(true);
    expect(isExpression('-5')).toBe(false);
    expect(isExpression('130')).toBe(false);
  });
});
