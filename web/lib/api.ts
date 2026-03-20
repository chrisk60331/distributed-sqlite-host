import axios from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("db_host_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Auth ───────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
}

export async function signup(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/signup", { email, password });
  return data;
}

export async function signin(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/signin", { email, password });
  return data;
}

// ── Databases ──────────────────────────────────────────────────────────────────

export interface Database {
  db_id: string;
  name: string;
  bucket: string;
  prefix: string;
  region: string;
  created_at: string;
}

/** Returned only from POST /databases (save the key — it is not shown again). */
export interface CreateDatabaseResult extends Database {
  api_key: string;
}

export async function listDatabases(): Promise<Database[]> {
  const { data } = await api.get<Database[]>("/databases");
  return data;
}

export interface CreateDatabaseOptions {
  byo_role_arn?: string;
  byo_bucket_name?: string;
  byo_bucket_region?: string;
}

export async function createDatabase(
  name: string,
  byo?: CreateDatabaseOptions
): Promise<CreateDatabaseResult> {
  const { data } = await api.post<CreateDatabaseResult>("/databases", { name, ...byo });
  return data;
}

export async function deleteDatabase(dbId: string): Promise<void> {
  await api.delete(`/databases/${dbId}`);
}

export interface DatabaseExecuteStepResult {
  columns: string[];
  rows: unknown[][];
}

export interface DatabaseExecuteResponse {
  steps: (DatabaseExecuteStepResult | null)[];
}

export async function executeDatabaseScript(
  dbId: string,
  statements: string[]
): Promise<DatabaseExecuteResponse> {
  const { data } = await api.post<DatabaseExecuteResponse>(`/databases/${dbId}/execute`, {
    statements,
  });
  return data;
}

export function getEnvDownloadUrl(dbId: string): string {
  const token = typeof window !== "undefined" ? localStorage.getItem("db_host_token") : "";
  return `${BASE_URL}/databases/${dbId}/env?token=${token}`;
}

export async function getEnvContent(dbId: string): Promise<string> {
  const { data } = await api.get<string>(`/databases/${dbId}/env`, {
    responseType: "text",
  });
  return data;
}

// ── BYO Bucket ────────────────────────────────────────────────────────────────

export interface BYOSetupResponse {
  external_id: string;
  platform_aws_account_id: string;
  cf_launch_url: string | null;
  already_connected: boolean;
}

export interface BYOConnectResponse {
  external_id: string;
  role_arn: string;
  bucket_name: string;
  bucket_region: string;
  validated_at: string;
}

export async function byoSetup(): Promise<BYOSetupResponse> {
  const { data } = await api.get<BYOSetupResponse>("/byo-bucket/setup");
  return data;
}

export async function byoConnect(
  role_arn: string,
  bucket_name: string,
  bucket_region: string
): Promise<BYOConnectResponse> {
  const { data } = await api.post<BYOConnectResponse>("/byo-bucket/connect", {
    role_arn,
    bucket_name,
    bucket_region,
  });
  return data;
}

export async function byoGetConfig(): Promise<BYOConnectResponse> {
  const { data } = await api.get<BYOConnectResponse>("/byo-bucket/config");
  return data;
}

export async function byoDeleteConfig(): Promise<void> {
  await api.delete("/byo-bucket/config");
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export interface AdminUserRow {
  user_id: string;
  email: string;
  created_at: string;
}

export interface AdminDatabaseRow {
  db_id: string;
  user_id: string;
  owner_email: string;
  name: string;
  bucket: string;
  prefix: string;
  region: string;
  created_at: string;
  connection_url: string;
}

export interface AdminBootstrap {
  users: AdminUserRow[];
  databases: AdminDatabaseRow[];
}

export async function checkAdminAccess(): Promise<boolean> {
  try {
    await api.get<{ admin: boolean }>("/admin/access");
    return true;
  } catch {
    return false;
  }
}

export async function getAdminBootstrap(): Promise<AdminBootstrap> {
  const { data } = await api.get<AdminBootstrap>("/admin/bootstrap");
  return data;
}

export async function adminDeleteUser(
  userId: string
): Promise<{ databases_removed: number }> {
  const { data } = await api.delete<{ databases_removed: number }>(
    `/admin/users/${userId}`
  );
  return data;
}

export async function adminDeleteDatabase(dbId: string): Promise<void> {
  await api.delete(`/admin/databases/${dbId}`);
}
