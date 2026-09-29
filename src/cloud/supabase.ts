import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

const SAVE_KEY = "pokerogue-regions-v1";
const BACKUP_KEY = SAVE_KEY + "-backup";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const cloudConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = cloudConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export type CloudSaveRow = {
  user_id: string;
  save_data: Record<string, unknown>;
  save_version: number;
  updated_at: string;
};

export type LocalSaveSummary = {
  exists: boolean;
  trainerName: string;
  wins: number;
  totalRuns: number;
  caught: number;
  updatedAt: string | null;
};

const readLocalSaveObject = (): Record<string, unknown> | null => {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
};

export const getLocalSaveSummary = (): LocalSaveSummary => {
  const save = readLocalSaveObject();
  if (!save) {
    return { exists: false, trainerName: "Gast", wins: 0, totalRuns: 0, caught: 0, updatedAt: null };
  }

  const profile = save.profile && typeof save.profile === "object"
    ? save.profile as Record<string, unknown>
    : null;

  return {
    exists: true,
    trainerName: typeof profile?.name === "string" ? profile.name : "Trainer",
    wins: typeof profile?.wins === "number" ? profile.wins : 0,
    totalRuns: typeof profile?.totalRuns === "number" ? profile.totalRuns : 0,
    caught: Array.isArray(save.caught) ? save.caught.length : 0,
    updatedAt: typeof save.updatedAt === "string" ? save.updatedAt : null,
  };
};

export const getSession = async (): Promise<Session | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};

export const subscribeToAuth = (callback: (session: Session | null) => void) => {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
};

export const signInWithDiscord = async () => {
  if (!supabase) throw new Error("Cloud-Login ist noch nicht konfiguriert.");
  const redirectTo = new URL(import.meta.env.BASE_URL || "/", window.location.origin).toString();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: { redirectTo },
  });
  if (error) throw error;
};

export const signInWithEmail = async (email: string) => {
  if (!supabase) throw new Error("Cloud-Login ist noch nicht konfiguriert.");
  const redirectTo = new URL(import.meta.env.BASE_URL || "/", window.location.origin).toString();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
};

export const signOut = async () => {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const fetchCloudSave = async (): Promise<CloudSaveRow | null> => {
  if (!supabase) return null;
  const session = await getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from("cloud_saves")
    .select("user_id,save_data,save_version,updated_at")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) throw error;
  return data as CloudSaveRow | null;
};

export const uploadLocalSave = async (): Promise<CloudSaveRow> => {
  if (!supabase) throw new Error("Cloud-Save ist noch nicht konfiguriert.");
  const session = await getSession();
  if (!session) throw new Error("Bitte zuerst anmelden.");

  const save = readLocalSaveObject();
  if (!save) throw new Error("Kein lokaler Spielstand gefunden.");

  const saveVersion = typeof save.saveVersion === "number" ? save.saveVersion : 5;

  const { data, error } = await supabase
    .from("cloud_saves")
    .upsert({
      user_id: session.user.id,
      save_data: save,
      save_version: saveVersion,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })
    .select("user_id,save_data,save_version,updated_at")
    .single();

  if (error) throw error;
  return data as CloudSaveRow;
};

export const restoreCloudSave = async (): Promise<void> => {
  const cloud = await fetchCloudSave();
  if (!cloud) throw new Error("Noch kein Cloud-Spielstand vorhanden.");

  const current = localStorage.getItem(SAVE_KEY);
  if (current) localStorage.setItem(BACKUP_KEY, current);
  localStorage.setItem(SAVE_KEY, JSON.stringify(cloud.save_data));
  window.location.reload();
};
