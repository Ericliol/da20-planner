/** Scanned weight & balance documents for the built-in aircraft (files in public/docs/). */
export interface AircraftDoc {
  title: string;
  file: string;
}

export const AIRCRAFT_DOCS: Record<string, AircraftDoc[]> = {
  // Weighing report WB-6071, D. MacArthur & Associates, 30-Nov-15 (pages 7–9 of 9).
  'vh-xtn': [
    { title: 'Load data sheet (30-Nov-15)', file: 'docs/vh-xtn-load-data-sheet.jpg' },
    { title: 'Loading check', file: 'docs/vh-xtn-loading-check.jpg' },
    { title: 'C of G chart', file: 'docs/vh-xtn-cg-chart.jpg' },
  ],
  // CASA load data sheet DA 735, Issue One, 14-7-02.
  'vh-huu': [{ title: 'Load data sheet (14-7-02)', file: 'docs/vh-huu-load-data-sheet.jpg' }],
};
