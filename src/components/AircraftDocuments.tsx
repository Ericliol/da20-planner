import { useEffect, useState } from 'react';
import { AIRCRAFT_DOCS, type AircraftDoc } from '../docs';
import type { Aircraft } from '../lib/wb';
import { Card } from './ui';

const fileName = (ac: Aircraft, doc: AircraftDoc) => `${ac.registration} ${doc.title.replace(/[^\w -]/g, '')}.jpg`;

/** The aircraft's load data sheet scans, viewable full size and downloadable. */
export function AircraftDocuments({ aircraft }: { aircraft: Aircraft }) {
  const docs = AIRCRAFT_DOCS[aircraft.id] ?? [];
  const [open, setOpen] = useState<AircraftDoc | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <Card title="Load data sheet">
      {docs.length === 0 ? (
        <p className="text-sm text-slate-500">No load data sheet on file for {aircraft.registration}.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {docs.map((doc) => (
            <figure key={doc.file} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              <button type="button" onClick={() => setOpen(doc)} className="block w-full" aria-label={`View ${doc.title}`}>
                <img src={doc.file} alt={`${aircraft.registration} ${doc.title}`} loading="lazy" className="aspect-[3/4] w-full object-cover object-top" />
              </button>
              <figcaption className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
                <span className="truncate text-slate-700">{doc.title}</span>
                <a href={doc.file} download={fileName(aircraft, doc)} className="shrink-0 font-medium text-sky-700 hover:underline">
                  Download
                </a>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-slate-900/90 p-3"
          role="dialog"
          aria-modal="true"
          aria-label={open.title}
          onClick={() => setOpen(null)}
        >
          <div className="mb-2 flex items-center justify-between gap-2 text-white" onClick={(e) => e.stopPropagation()}>
            <span className="truncate text-sm font-medium">
              {aircraft.registration}: {open.title}
            </span>
            <div className="flex shrink-0 gap-2">
              <a
                href={open.file}
                download={fileName(aircraft, open)}
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-200"
              >
                Download
              </a>
              <button type="button" onClick={() => setOpen(null)} className="rounded-lg px-3 py-1.5 text-sm hover:bg-white/10">
                Close
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <img
              src={open.file}
              alt={`${aircraft.registration} ${open.title}`}
              className="mx-auto max-w-full bg-white"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
