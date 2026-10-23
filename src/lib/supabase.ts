import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

/**
 * Supabase client for accounts and saved load sheets. The URL and the public
 * "anon" key are meant to be in the browser: access is enforced by the row
 * level security policies in supabase/schema.sql.
 * null until VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

export type AuthView = { session: Session | null; recovering: boolean; ready: boolean };

/** Current sign-in state, kept up to date with Supabase. */
export function useSession(): AuthView {
  const [view, setView] = useState<AuthView>({ session: null, recovering: false, ready: !supabase });
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setView((v) => ({ ...v, session: data.session, ready: true })));
    const { data } = supabase.auth.onAuthStateChange((event, session) =>
      // PASSWORD_RECOVERY: the user arrived from a password-reset email and must set a new password.
      setView((v) => ({ session, ready: true, recovering: event === 'PASSWORD_RECOVERY' ? true : event === 'USER_UPDATED' ? false : v.recovering })),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  return view;
}

export const displayName = (s: Session | null) =>
  (s?.user.user_metadata?.name as string | undefined) || s?.user.email || '';

/** Whether Google sign-in is switched on for the project (read from the public auth settings). */
export function useGoogleEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (!url || !key) return;
    let alive = true;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => alive && setEnabled(!!s?.external?.google))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return enabled;
}

/** Start Google sign-in; Google sends the user back to this page, where the session is picked up. */
export async function signInWithGoogle(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw error;
}
