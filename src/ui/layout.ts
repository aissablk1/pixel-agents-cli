/**
 * Terminal screen layout: allocates regions for title, office, status, and session bar.
 */

import { STATUS_BAR_ROWS, TITLE_BAR_ROWS, SESSION_BAR_ROWS } from '../constants.js';

export interface LayoutRegions {
  titleBar: { row: number; cols: number };
  office: { row: number; rows: number; cols: number };
  statusBar: { row: number; rows: number; cols: number };
  sessionBar: { row: number; cols: number };
}

export function computeLayout(
  termCols: number,
  termRows: number,
  agentCount: number,
): LayoutRegions {
  const statusRows = Math.min(Math.max(agentCount, 1) + 1, STATUS_BAR_ROWS + 1); // +1 for separator
  const officeRows = termRows - TITLE_BAR_ROWS - statusRows - SESSION_BAR_ROWS;

  return {
    titleBar: { row: 0, cols: termCols },
    office: { row: TITLE_BAR_ROWS, rows: Math.max(officeRows, 4), cols: termCols },
    statusBar: { row: TITLE_BAR_ROWS + Math.max(officeRows, 4), rows: statusRows, cols: termCols },
    sessionBar: { row: termRows - 1, cols: termCols },
  };
}
