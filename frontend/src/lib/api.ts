// Central REST client for the FarmSphere AI Flask backend.
// Replaces the Supabase client used by the reference application.
import axios, { type AxiosInstance } from "axios";

const TOKEN_KEY = "farmsphere_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export const api: AxiosInstance = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface ApiUser {
  id: string;
  email: string;
}

export interface Profile {
  id: string;
  full_name: string;
  location: string;
  farm_size: number;
  preferred_crops: string[];
  phone: string | null;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface Farm {
  id: string;
  user_id: string;
  name: string;
  location: string;
  total_area: number;
  soil_type: string;
  water_source: string;
  current_crop: string;
  created_at: string;
  updated_at: string;
}

export interface FarmZone {
  id: string;
  farm_id: string;
  user_id: string;
  name: string;
  crop: string;
  area: number;
  health_score: number;
  soil_moisture: number;
  growth_stage: string;
  grid_x: number;
  grid_y: number;
  created_at: string;
}

export interface FarmDataResponse {
  profile: Profile | null;
  farm: Farm | null;
  zones: FarmZone[];
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; message?: string } | undefined;
    return data?.error ?? data?.message ?? fallback;
  }
  return err instanceof Error ? err.message : fallback;
}

export const authApi = {
  async register(payload: {
    email: string;
    password: string;
    full_name: string;
    location: string;
    farm_size: number;
  }) {
    try {
      const { data } = await api.post<{ token: string; user: ApiUser }>("/auth/register", payload);
      return { data, error: null as string | null };
    } catch (err) {
      return { data: null, error: extractErrorMessage(err, "Registration failed") };
    }
  },
  async login(payload: { email: string; password: string }) {
    try {
      const { data } = await api.post<{ token: string; user: ApiUser }>("/auth/login", payload);
      return { data, error: null as string | null };
    } catch (err) {
      return { data: null, error: extractErrorMessage(err, "Login failed") };
    }
  },
  async me() {
    try {
      const { data } = await api.get<{ user: ApiUser }>("/auth/me");
      return { data, error: null as string | null };
    } catch (err) {
      return { data: null, error: extractErrorMessage(err, "Not authenticated") };
    }
  },
};

export const farmApi = {
  async getFarmData() {
    const { data } = await api.get<FarmDataResponse>("/farm-data");
    return data;
  },
  async updateProfile(payload: Partial<Profile> & { language?: string }) {
    try {
      const { data } = await api.put<{ profile: Profile }>("/profile", payload);
      return { data, error: null as string | null };
    } catch (err) {
      return { data: null, error: extractErrorMessage(err, "Could not save profile") };
    }
  },
  async saveFarm(payload: Partial<Farm>) {
    try {
      const { data } = await api.put<{ farm: Farm }>("/farm", payload);
      return { data, error: null as string | null };
    } catch (err) {
      return { data: null, error: extractErrorMessage(err, "Could not save farm") };
    }
  },
};

export async function requestAssistant(payload: {
  messages: { role: "user" | "assistant"; content: string }[];
  language?: string;
  context?: string;
}) {
  const { data } = await api.post<{ reply?: string; error?: string }>("/assistant", payload);
  return data;
}

export async function requestDiseaseDetection(payload: { image: string; crop?: string; language?: string }) {
  const { data } = await api.post<{ result?: unknown; error?: string }>("/detect-disease", payload);
  return data;
}

export interface DiseaseScan {
  id: string;
  crop: string;
  disease: string;
  confidence: number;
  severity: number;
  affected_area: number;
  risk_level: string;
  healthy: boolean;
  created_at: string;
}

export interface VoiceConsultation {
  id: string;
  language: string;
  query: string;
  response: string;
  status: string;
  created_at: string;
}

export const intelApi = {
  async listScans() {
    const { data } = await api.get<{ scans: DiseaseScan[] }>("/disease-scans");
    return data.scans;
  },
  async saveScan(payload: {
    crop: string;
    disease: string;
    confidence: number;
    severity: number;
    affected_area: number;
    risk_level: string;
    healthy: boolean;
  }) {
    await api.post("/disease-scans", payload);
  },
  async listConsultations() {
    const { data } = await api.get<{ consultations: VoiceConsultation[] }>("/voice-consultations");
    return data.consultations;
  },
  async saveConsultation(payload: { language: string; query: string; response: string; status: string }) {
    await api.post("/voice-consultations", payload);
  },
};

export async function requestVoiceDoctor(payload: { query: string; language?: string; context?: string }) {
  const { data } = await api.post<{ result?: unknown; error?: string }>("/voice-doctor", payload);
  return data;
}

export async function requestTts(payload: { text: string; language?: string }): Promise<Blob> {
  const res = await api.post("/tts", payload, { responseType: "blob" });
  return res.data as Blob;
}
