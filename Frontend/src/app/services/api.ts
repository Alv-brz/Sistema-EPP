const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'supervisor' | 'inspector';
  is_active: boolean;
  created_at: string;
}

export interface ApiCamera {
  id: string;
  code: string;
  name: string;
  location: string;
  area_id: string | null;
  area_name: string | null;
  ip: string;
  status: 'online' | 'offline';
  source_type: 'webcam' | 'rtsp';
  source_url: string | null;
  is_streaming: boolean;
  resolution: string;
  fps: number;
  created_at: string;
  updated_at: string;
}

export type CameraPayload = {
  name: string;
  location: string;
  area_id?: string | null;
  area_name?: string | null;
  ip: string;
  status: 'online' | 'offline';
  source_type: 'webcam' | 'rtsp';
  source_url: string | null;
  resolution: string;
  fps: number;
};

export interface ApiDetection {
  id: string;
  camera_id: string | null;
  area_id: string | null;
  area_name: string | null;
  location: string | null;
  image_url: string;
  annotated_image_url: string | null;
  detections: Array<{ label?: string; confidence?: number; box?: number[] }>;
  missing_epps: string[];
  severity: 'low' | 'medium' | 'high';
  confidence_threshold: number;
  processed_ms: number;
  created_by: string;
  created_at: string;
}

export interface DetectionListResponse {
  items: ApiDetection[];
  total: number;
  limit: number;
  offset: number;
}

export interface DashboardStats {
  total_cameras: number;
  active_cameras: number;
  total_violations_today: number;
  active_alerts: number;
  compliance: number;
  people_detected_today: number;
  people_currently_in_area: number;
  recent_violations: ApiDetection[];
}

export interface ReportSummary {
  stats: Array<{ label: string; value: string; change: string; trend: 'up' | 'down' }>;
  violations_by_day: Array<{ day: string; violations: number }>;
  violations_by_epp: Array<{ name: string; value: number; color: string }>;
  compliance_by_area: Array<{ area: string; compliance: number }>;
}

export interface ApiArea {
  id: string;
  name: string;
  description: string;
  required_epps: Array<'casco' | 'chaleco' | 'guantes' | 'botas' | 'lentes'>;
  created_at: string;
  updated_at: string;
}

export type AreaPayload = Pick<ApiArea, 'name' | 'description' | 'required_epps'>;

export interface YoloSettings {
  active_model: 'best.pt' | 'belst.pt' | 'bes33t.pt';
  confidence_threshold: number;
  enabled_classes: string[];
  detection_enabled: boolean;
  available_models: string[];
  available_classes: string[];
  recommended_threshold: number;
}

export interface LoginResponse {
  access_token: string;
  token_type: 'bearer';
  user: ApiUser;
}

export async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error('Invalid credentials');
  }

  return response.json();
}

export async function meRequest(token: string): Promise<ApiUser> {
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Invalid session');
  }

  return response.json();
}

export function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const authHeaders = getAuthHeaders();
  Object.entries(authHeaders).forEach(([key, value]) => headers.set(key, String(value)));

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json();
}

export function listUsers(): Promise<ApiUser[]> {
  return apiRequest<ApiUser[]>('/users');
}

export function createUser(payload: { name: string; email: string; password: string; role: ApiUser['role'] }): Promise<ApiUser> {
  return apiRequest<ApiUser>('/users', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateUser(
  id: string,
  payload: { name?: string; password?: string; role?: ApiUser['role']; is_active?: boolean },
): Promise<ApiUser> {
  return apiRequest<ApiUser>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function deleteUser(id: string): Promise<void> {
  return apiRequest<void>(`/users/${id}`, { method: 'DELETE' });
}

export function getAreas(): Promise<ApiArea[]> {
  return apiRequest<ApiArea[]>('/areas');
}

export function getArea(id: string): Promise<ApiArea> {
  return apiRequest<ApiArea>(`/areas/${id}`);
}

export function createArea(payload: AreaPayload): Promise<ApiArea> {
  return apiRequest<ApiArea>('/areas', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateArea(id: string, payload: AreaPayload): Promise<ApiArea> {
  return apiRequest<ApiArea>(`/areas/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export function deleteArea(id: string): Promise<void> {
  return apiRequest<void>(`/areas/${id}`, { method: 'DELETE' });
}

export function listCameras(): Promise<ApiCamera[]> {
  return apiRequest<ApiCamera[]>('/cameras');
}

export function createCamera(payload: CameraPayload): Promise<ApiCamera> {
  return apiRequest<ApiCamera>('/cameras', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateCamera(id: string, payload: Partial<CameraPayload>): Promise<ApiCamera> {
  return apiRequest<ApiCamera>(`/cameras/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function deleteCamera(id: string): Promise<void> {
  return apiRequest<void>(`/cameras/${id}`, { method: 'DELETE' });
}

export function startCamera(id: string): Promise<ApiCamera> {
  return apiRequest<ApiCamera>(`/cameras/${id}/start`, { method: 'POST' });
}

export function stopCamera(id: string): Promise<ApiCamera> {
  return apiRequest<ApiCamera>(`/cameras/${id}/stop`, { method: 'POST' });
}

export function getCameraStreamUrl(id: string): string {
  const token = localStorage.getItem('access_token') ?? '';
  return `${API_URL}/cameras/${id}/stream?token=${encodeURIComponent(token)}`;
}

export function getDashboardStats(): Promise<DashboardStats> {
  return apiRequest<DashboardStats>('/dashboard/stats');
}

export function getDetectionHistory(): Promise<DetectionListResponse> {
  return apiRequest<DetectionListResponse>('/detections/history?limit=200');
}

export function getReportSummary(): Promise<ReportSummary> {
  return apiRequest<ReportSummary>('/reports/summary');
}

export function getYoloSettings(): Promise<YoloSettings> {
  return apiRequest<YoloSettings>('/settings/yolo');
}

export function updateYoloSettings(payload: Pick<YoloSettings, 'active_model' | 'confidence_threshold' | 'enabled_classes' | 'detection_enabled'>): Promise<YoloSettings> {
  return apiRequest<YoloSettings>('/settings/yolo', { method: 'PUT', body: JSON.stringify(payload) });
}
