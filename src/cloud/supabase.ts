import { createClient, type AuthChangeEvent, type Session, type SupabaseClient } from "@supabase/supabase-js";

export const SAVE_KEY = "pokerogue-regions-v1";
export const BACKUP_KEY = SAVE_KEY + "-backup";

const publicSupabaseUrl = "https://etwpxprwccctrmestthp.supabase.co";
const publicSupabaseKey = "sb_publishable_Nd_3j42Yj_nxfWslEwzHLg_FVEljhHm";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || publicSupabaseUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || publicSupabaseKey;

export const cloudConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = cloudConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
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
  meaningful: boolean;
  trainerName: string;
  wins: number;
  totalRuns: number;
  caught: number;
};

export const readLocalSaveObject = (): Record<string, unknown> | null => {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
};

export const readLocalSaveRaw = () => localStorage.getItem(SAVE_KEY);

export const getLocalSaveSummary = (): LocalSaveSummary => {
  const save = readLocalSaveObject();
  if (!save) {
    return { exists: false, meaningful: false, trainerName: "Gast", wins: 0, totalRuns: 0, caught: 0 };
  }

  const profile = save.profile && typeof save.profile === "object"
    ? save.profile as Record<string, unknown>
    : null;

  return {
    exists: true,
    meaningful: Boolean(profile),
    trainerName: typeof profile?.name === "string" ? profile.name : "Gast",
    wins: typeof profile?.wins === "number" ? profile.wins : 0,
    totalRuns: typeof profile?.totalRuns === "number" ? profile.totalRuns : 0,
    caught: Array.isArray(save.caught) ? save.caught.length : 0,
  };
};

export const getSession = async (): Promise<Session | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};

export const subscribeToAuth = (
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) => {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) => callback(event, session));
  return () => data.subscription.unsubscribe();
};

const redirectUrl = () => new URL(import.meta.env.BASE_URL || "/", window.location.origin).toString();

export const signInWithDiscord = async () => {
  if (!supabase) throw new Error("Account-System ist noch nicht konfiguriert.");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: { redirectTo: redirectUrl() },
  });
  if (error) throw error;
};

export const signInWithPassword = async (email: string, password: string) => {
  if (!supabase) throw new Error("Account-System ist noch nicht konfiguriert.");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
};

export const signUpWithPassword = async (
  trainerName: string,
  email: string,
  password: string,
) => {
  if (!supabase) throw new Error("Account-System ist noch nicht konfiguriert.");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl(),
      data: { trainer_name: trainerName.trim().slice(0, 32) },
    },
  });
  if (error) throw error;
  return data;
};

export const sendPasswordReset = async (email: string) => {
  if (!supabase) throw new Error("Account-System ist noch nicht konfiguriert.");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl(),
  });
  if (error) throw error;
};

export const updatePassword = async (password: string) => {
  if (!supabase) throw new Error("Account-System ist noch nicht konfiguriert.");
  const { error } = await supabase.auth.updateUser({ password });
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

export const uploadSaveObject = async (
  save: Record<string, unknown>,
): Promise<CloudSaveRow> => {
  if (!supabase) throw new Error("Cloud-Save ist noch nicht konfiguriert.");
  const session = await getSession();
  if (!session) throw new Error("Bitte zuerst anmelden.");

  const saveVersion = typeof save.saveVersion === "number" ? save.saveVersion : 5;
  const updatedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("cloud_saves")
    .upsert({
      user_id: session.user.id,
      save_data: save,
      save_version: saveVersion,
      updated_at: updatedAt,
    }, { onConflict: "user_id" })
    .select("user_id,save_data,save_version,updated_at")
    .single();

  if (error) throw error;
  return data as CloudSaveRow;
};

export const uploadLocalSave = async (): Promise<CloudSaveRow> => {
  const save = readLocalSaveObject();
  if (!save) throw new Error("Kein lokaler Spielstand gefunden.");
  return uploadSaveObject(save);
};

export const installCloudSaveLocally = (cloud: CloudSaveRow) => {
  const current = localStorage.getItem(SAVE_KEY);
  if (current) localStorage.setItem(BACKUP_KEY, current);
  localStorage.setItem(SAVE_KEY, JSON.stringify(cloud.save_data));
};
