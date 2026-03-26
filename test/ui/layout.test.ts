import { computeLayout } from '../../src/ui/layout.js';

describe('computeLayout', () => {
  it('with 80 cols, 24 rows, 1 agent: office region has positive rows', () => {
    const layout = computeLayout(80, 24, 1);
    expect(layout.office.rows).toBeGreaterThan(0);
  });

  it('with 80 cols, 24 rows, 0 agents: still returns valid layout', () => {
    const layout = computeLayout(80, 24, 0);
    expect(layout.titleBar).toBeDefined();
    expect(layout.office).toBeDefined();
    expect(layout.statusBar).toBeDefined();
    expect(layout.sessionBar).toBeDefined();
    expect(layout.office.rows).toBeGreaterThan(0);
  });

  it('with 40 cols, 10 rows (minimum): all regions have row >= 0', () => {
    const layout = computeLayout(40, 10, 1);
    expect(layout.titleBar.row).toBeGreaterThanOrEqual(0);
    expect(layout.office.row).toBeGreaterThanOrEqual(0);
    expect(layout.statusBar.row).toBeGreaterThanOrEqual(0);
    expect(layout.sessionBar.row).toBeGreaterThanOrEqual(0);
  });

  it('titleBar is always row 0', () => {
    const layout1 = computeLayout(80, 24, 1);
    const layout2 = computeLayout(120, 40, 5);
    const layout3 = computeLayout(40, 10, 0);
    expect(layout1.titleBar.row).toBe(0);
    expect(layout2.titleBar.row).toBe(0);
    expect(layout3.titleBar.row).toBe(0);
  });

  it('sessionBar is always last row (termRows - 1)', () => {
    expect(computeLayout(80, 24, 1).sessionBar.row).toBe(23);
    expect(computeLayout(120, 40, 3).sessionBar.row).toBe(39);
    expect(computeLayout(40, 10, 0).sessionBar.row).toBe(9);
  });

  it('office row starts after title bar', () => {
    const layout = computeLayout(80, 24, 1);
    expect(layout.office.row).toBeGreaterThan(layout.titleBar.row);
  });

  it('statusBar row is between office and sessionBar', () => {
    const layout = computeLayout(80, 24, 2);
    const officeEnd = layout.office.row + layout.office.rows;
    expect(layout.statusBar.row).toBeGreaterThanOrEqual(officeEnd);
    expect(layout.statusBar.row).toBeLessThan(layout.sessionBar.row);
  });
});
