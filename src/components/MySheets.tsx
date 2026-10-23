import { useEffect, useState } from 'react';
import { fmtArm, fmtDist, fmtMass } from '../lib/format';
import { deleteSheet, listSheets, type SavedSheet } from '../lib/sheets';
import { type AuthView, displayName, signInWithGoogle, supabase, useGoogleEnabled } from '../lib/supabase';
import type { Units } from '../state';
import { Card, StatusPill } from './ui';

/** "My sheets" tab: sign in / create account, then the user's saved load sheets. */
export function MySheets(props: { auth: AuthView; units: Units; reloadKey: number; onOpen: (s: SavedSheet) => void }) {
  const { auth, units, reloadKey, onOpen } = props;
  if (!supabase) {
    return (
      <Card title="My sheets">
        <p className="text-sm text-slate-700">Accounts aren't set up yet, so load sheets can't be saved. Everything else works.</p>
      </Card>
    );
  }
  if (!auth.ready) return <p className="text-sm text-slate-500">Loading…</p>;
  if (auth.recovering) return <NewPassword />;
  if (!auth.session) return <SignIn />;
  return <SheetList auth={auth} units={units} reloadKey={reloadKey} onOpen={onOpen} />;
}

const input =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200';
const primary = 'rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40';

function SignIn() {
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const google = useGoogleEnabled();

  const submit = async () => {
    if (!supabase) return;
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'up') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name: name.trim() } } });
        if (error) throw error;
        if (!data.session) setMsg({ ok: true, text: 'Account created. Check your email to confirm it, then sign in.' });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split('#')[0] });
        if (error) throw error;
        setMsg({ ok: true, text: 'If that email has an account, a password-reset link is on its way.' });
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Reset password';
  return (
    <div className="mx-auto max-w-md">
      <Card title={title}>
        {google && mode !== 'reset' && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setMsg(null);
                try {
                  await signInWithGoogle();
                } catch (e) {
                  setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
                  setBusy(false);
                }
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              <svg viewBox="0 0 48 48" className="size-4" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
              Continue with Google
            </button>
            <div className="my-3 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              or with email
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          </>
        )}
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {mode === 'up' && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Name</span>
              <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Email</span>
            <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          {mode !== 'reset' && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Password</span>
              <input
                className={input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
                minLength={8}
                required
              />
              {mode === 'up' && <span className="mt-1 block text-xs text-slate-500">At least 8 characters.</span>}
            </label>
          )}
          <button type="submit" disabled={busy} className={`w-full ${primary}`}>
            {busy ? 'Please wait…' : title}
          </button>
        </form>
        {msg && (
          <p className={`mt-3 rounded-md px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>{msg.text}</p>
        )}
        <div className="mt-4 flex flex-wrap justify-between gap-2 text-sm">
          {mode !== 'in' && (
            <button type="button" className="text-sky-700 hover:underline" onClick={() => setMode('in')}>
              Back to sign in
            </button>
          )}
          {mode === 'in' && (
            <>
              <button type="button" className="text-sky-700 hover:underline" onClick={() => setMode('up')}>
                Create an account
              </button>
              <button type="button" className="text-slate-600 hover:underline" onClick={() => setMode('reset')}>
                Forgot password?
              </button>
            </>
          )}
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Your saved load sheets are private to your account. Planning without an account still works; you just can't save.
        </p>
      </Card>
    </div>
  );
}

function NewPassword() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <div className="mx-auto max-w-md">
      <Card title="Set a new password">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!supabase) return;
            setBusy(true);
            const { error } = await supabase.auth.updateUser({ password });
            setBusy(false);
            if (error) setErr(error.message);
          }}
        >
          <input className={input} type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <button type="submit" disabled={busy} className={`w-full ${primary}`}>
            Save new password
          </button>
        </form>
        {err && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}
      </Card>
    </div>
  );
}

const when = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}${p(d.getUTCMinutes())}Z`;
};

function SheetList({ auth, units, reloadKey, onOpen }: { auth: AuthView; units: Units; reloadKey: number; onOpen: (s: SavedSheet) => void }) {
  const [sheets, setSheets] = useState<SavedSheet[] | null>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  // Fetch the list when shown, after a save (reloadKey) and after a delete (refresh).
  useEffect(() => {
    let alive = true;
    listSheets()
      .then((data) => {
        if (!alive) return;
        setSheets(data);
        setError('');
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [reloadKey, refresh]);

  return (
    <Card
      title="My saved load sheets"
      right={
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-600">{displayName(auth.session)}</span>
          <button type="button" className="rounded-lg border border-slate-300 px-2.5 py-1 hover:bg-slate-50" onClick={() => supabase?.auth.signOut()}>
            Sign out
          </button>
        </div>
      }
    >
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">⚠ {error}</p>}
      {sheets === null && !error && <p className="text-sm text-slate-500">Loading…</p>}
      {sheets?.length === 0 && (
        <p className="text-sm text-slate-600">No saved sheets yet. Fill in W&amp;B and Performance, then press Save in the top bar.</p>
      )}
      {!!sheets?.length && (
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[640px] text-sm tabular-nums">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-1.5 pr-2 font-medium">Saved (UTC)</th>
                <th className="py-1.5 pr-2 font-medium">Aircraft</th>
                <th className="py-1.5 pr-2 font-medium">Route</th>
                <th className="py-1.5 pr-2 text-right font-medium">T/O weight · CG</th>
                <th className="py-1.5 pr-2 text-right font-medium">TODR / LDR</th>
                <th className="py-1.5 pr-2 font-medium">Result</th>
                <th className="py-1.5" />
              </tr>
            </thead>
            <tbody>
              {sheets.map((s) => (
                <tr key={s.id} className="border-b border-slate-100">
                  <td className="whitespace-nowrap py-1.5 pr-2">{when(s.created_at)}</td>
                  <td className="py-1.5 pr-2 font-medium">{s.registration}</td>
                  <td className="py-1.5 pr-2">
                    {s.summary.departureIcao || '–'} → {s.summary.arrivalIcao || '–'}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-2 text-right">
                    {fmtMass(s.summary.takeoffMassKg, units)} · {fmtArm(s.summary.takeoffArmM, units)}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-2 text-right">
                    {s.summary.todr === null ? '–' : fmtDist(s.summary.todr)} / {fmtDist(s.summary.ldr)}
                  </td>
                  <td className="py-1.5 pr-2">
                    <StatusPill ok={s.within_limits}>{s.within_limits ? 'Within limits' : 'Out of limits'}</StatusPill>
                  </td>
                  <td className="whitespace-nowrap py-1.5 text-right">
                    <button type="button" className="rounded-md px-2 py-1 text-sky-700 hover:bg-sky-50" onClick={() => onOpen(s)}>
                      Open
                    </button>
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-red-700 hover:bg-red-50"
                      onClick={async () => {
                        if (!confirm(`Delete the ${s.registration} sheet saved ${when(s.created_at)}?`)) return;
                        try {
                          await deleteSheet(s.id);
                          setRefresh((r) => r + 1);
                        } catch (e) {
                          setError(e instanceof Error ? e.message : String(e));
                        }
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Open loads a sheet's inputs so you can view or print it; the saved record itself never changes. Only you can see
        your sheets.
      </p>
    </Card>
  );
}
