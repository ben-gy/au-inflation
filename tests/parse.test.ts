// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import { describe, expect, it } from 'vitest';
import {
  parseCsv,
  parseSdmx,
  quarterIndex,
  quarterFromIndex,
  periodLabel,
  num,
  buildHierarchy,
  parseIndexSeries,
  valueAt,
  cumChange,
  reconcileAnnual,
  reconcileContribSum,
  latestAnnualByCode,
  latestContribByCode,
} from '../pipeline/parse.mjs';

describe('parseCsv (RFC-4180)', () => {
  it('splits simple rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });
  it('handles quoted fields with embedded commas', () => {
    const rows = parseCsv('name,val\n"Food, drink",100');
    expect(rows[1]).toEqual(['Food, drink', '100']);
  });
  it('handles escaped double-quotes', () => {
    const rows = parseCsv('a\n"say ""hi"""');
    expect(rows[1][0]).toBe('say "hi"');
  });
  it('strips a BOM and ignores CR', () => {
    const rows = parseCsv('﻿a,b\r\n1,2\r\n');
    expect(rows[0]).toEqual(['a', 'b']);
    expect(rows[1]).toEqual(['1', '2']);
  });
});

describe('parseSdmx', () => {
  it('keys rows by header', () => {
    const rows = parseSdmx('INDEX,TIME_PERIOD,OBS_VALUE\n10001,2025-Q3,143.6\n');
    expect(rows).toHaveLength(1);
    expect(rows[0].INDEX).toBe('10001');
    expect(rows[0].OBS_VALUE).toBe('143.6');
  });
});

describe('quarter maths', () => {
  it('round-trips period <-> index', () => {
    for (const p of ['1948-Q3', '2000-Q1', '2025-Q3', '2026-Q4']) {
      expect(quarterFromIndex(quarterIndex(p))).toBe(p);
    }
  });
  it('orders chronologically', () => {
    expect(quarterIndex('2025-Q3')).toBeGreaterThan(quarterIndex('2025-Q1'));
    expect(quarterIndex('2025-Q1')).toBeGreaterThan(quarterIndex('2024-Q4'));
  });
  it('labels months', () => {
    expect(periodLabel('2025-Q3')).toBe('September 2025');
    expect(periodLabel('2000-Q1')).toBe('March 2000');
  });
  it('rejects a bad period', () => {
    expect(() => quarterIndex('2025-Q5')).toThrow();
  });
});

describe('num sentinels', () => {
  it('coerces blanks and junk to null, keeps numbers', () => {
    expect(num('')).toBeNull();
    expect(num(null)).toBeNull();
    expect(num('NaN')).toBeNull();
    expect(num('143.6')).toBe(143.6);
    expect(num('1,234.5')).toBe(1234.5);
    expect(num('-2.1')).toBe(-2.1);
  });
});

describe('buildHierarchy', () => {
  const codelist = {
    data: {
      codelists: [
        {
          codes: [
            { id: '10001', name: 'All groups CPI', parent: null, annotations: [{ type: 'ORDER', text: '10' }] },
            { id: '20003', name: 'Housing', parent: '10001', description: 'Housing group', annotations: [{ type: 'ORDER', text: '20' }] },
            { id: '30014', name: 'Rents', parent: '20003', annotations: [] },
          ],
        },
      ],
    },
  };
  it('assigns levels by walking parents', () => {
    const h = buildHierarchy(codelist);
    expect(h.get('10001').level).toBe(0);
    expect(h.get('20003').level).toBe(1);
    expect(h.get('30014').level).toBe(2);
  });
  it('keeps names, parents and descriptions', () => {
    const h = buildHierarchy(codelist);
    expect(h.get('20003').name).toBe('Housing');
    expect(h.get('20003').description).toBe('Housing group');
    expect(h.get('30014').parent).toBe('20003');
  });
});

const INDEX_CSV = [
  'DATAFLOW,MEASURE,INDEX,TSEST,REGION,FREQ,TIME_PERIOD,OBS_VALUE',
  'ABS:CPI,1,10001,10,50,Q,2023-Q3,130.0',
  'ABS:CPI,1,10001,10,50,Q,2024-Q3,140.0',
  'ABS:CPI,1,10001,10,50,Q,2025-Q3,143.6',
  'ABS:CPI,1,20003,10,50,Q,2024-Q3,150.0',
  'ABS:CPI,1,20003,10,50,Q,2025-Q3,159.0',
].join('\n');

describe('parseIndexSeries', () => {
  it('builds contiguous dense series per code', () => {
    const { series, gmin, gmax } = parseIndexSeries(INDEX_CSV);
    expect(series.has('10001')).toBe(true);
    const all = series.get('10001');
    expect(all.s).toBe(quarterIndex('2023-Q3'));
    expect(all.v).toHaveLength(quarterIndex('2025-Q3') - quarterIndex('2023-Q3') + 1);
    expect(valueAt(all, quarterIndex('2025-Q3'))).toBe(143.6);
    expect(gmin).toBe(quarterIndex('2023-Q3'));
    expect(gmax).toBe(quarterIndex('2025-Q3'));
  });
  it('fills internal gaps with null', () => {
    const gapped = 'INDEX,TIME_PERIOD,OBS_VALUE\n10001,2023-Q3,100\n10001,2025-Q3,110';
    const { series } = parseIndexSeries(gapped);
    const s = series.get('10001');
    expect(s.v.some((x: number | null) => x === null)).toBe(true);
  });
});

describe('cumChange', () => {
  it('computes percentage change between quarters', () => {
    const { series } = parseIndexSeries(INDEX_CSV);
    const all = series.get('10001');
    // 130 -> 143.6 over 2 years
    expect(cumChange(all, quarterIndex('2023-Q3'), quarterIndex('2025-Q3'))).toBeCloseTo((143.6 / 130 - 1) * 100, 5);
  });
});

describe('reconcileAnnual (gate 1)', () => {
  const annualRows = parseSdmx(
    [
      'MEASURE,INDEX,TIME_PERIOD,OBS_VALUE',
      // published annual for 10001: 140/130-1 = 7.69, 143.6/140-1 = 2.57
      '3,10001,2024-Q3,7.7',
      '3,10001,2025-Q3,2.6',
    ].join('\n'),
  );
  it('passes when computed matches published', () => {
    const { series } = parseIndexSeries(INDEX_CSV);
    const r = reconcileAnnual(series, annualRows, '10001', 0.15);
    expect(r.violations).toHaveLength(0);
    expect(r.checked).toBe(2);
  });
  it('flags a swapped/garbled series', () => {
    const bad = INDEX_CSV.replace('2025-Q3,143.6', '2025-Q3,999');
    const { series } = parseIndexSeries(bad);
    const r = reconcileAnnual(series, annualRows, '10001', 0.15);
    expect(r.violations.length).toBeGreaterThan(0);
  });
});

describe('reconcileContribSum (gate 2)', () => {
  it('passes when group contributions sum to the all-groups index', () => {
    const idx = parseIndexSeries(
      ['INDEX,TIME_PERIOD,OBS_VALUE', '10001,2025-Q3,100', 'A,2025-Q3,0', 'B,2025-Q3,0'].join('\n'),
    ).series;
    const contrib = parseSdmx(['INDEX,TIME_PERIOD,OBS_VALUE', 'A,2025-Q3,60', 'B,2025-Q3,40'].join('\n'));
    const r = reconcileContribSum(idx, contrib, ['A', 'B'], '10001', 0.2);
    expect(r.violations).toHaveLength(0);
    expect(r.checked).toBe(1);
  });
  it('flags a contribution sum that misses the index', () => {
    const idx = parseIndexSeries(['INDEX,TIME_PERIOD,OBS_VALUE', '10001,2025-Q3,100'].join('\n')).series;
    const contrib = parseSdmx(['INDEX,TIME_PERIOD,OBS_VALUE', 'A,2025-Q3,60', 'B,2025-Q3,30'].join('\n'));
    const r = reconcileContribSum(idx, contrib, ['A', 'B'], '10001', 0.2);
    expect(r.violations.length).toBe(1);
  });
});

describe('latest helpers', () => {
  it('finds the latest annual per code', () => {
    const rows = parseSdmx(['MEASURE,INDEX,TIME_PERIOD,OBS_VALUE', '3,X,2024-Q3,5', '3,X,2025-Q3,3'].join('\n'));
    const m = latestAnnualByCode(rows);
    expect(m.get('X').value).toBe(3);
  });
  it('finds the latest contribution per code at the latest period', () => {
    const rows = parseSdmx(['INDEX,TIME_PERIOD,OBS_VALUE', 'X,2025-Q2,10', 'X,2025-Q3,12', 'Y,2025-Q3,8'].join('\n'));
    const { byCode, latestQi } = latestContribByCode(rows);
    expect(latestQi).toBe(quarterIndex('2025-Q3'));
    expect(byCode.get('X')).toBe(12);
    expect(byCode.get('Y')).toBe(8);
  });
});
