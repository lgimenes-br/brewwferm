import { API_URL } from '../config';

const getHeaders = (token?: string | null) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  const currentToken = token || localStorage.getItem('token');
  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }
  return headers;
};

const checkUnauthorized = (res: Response) => {
  if (res.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }
};

let cachedFirmwareInfo: { data: { version: string; md5?: string; url?: string } | null; ts: number } | null = null;
export const fetchFirmwareVersion = async (): Promise<{ version: string; md5?: string; url?: string } | null> => {
  if (cachedFirmwareInfo && Date.now() - cachedFirmwareInfo.ts < 60000) {
    return cachedFirmwareInfo.data;
  }
  try {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const res = await fetch(`${baseUrl}/firmware/version.json?t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      cachedFirmwareInfo = { data, ts: Date.now() };
      return data;
    }
  } catch (e) {
    // Ignore firmware check failures offline
  }
  return null;
};

export const sendDeviceCommand = async (serialCode: string, type: string, payload: any = {}, token?: string | null) => {
  const res = await fetch(`${API_URL}/devices/${encodeURIComponent(serialCode)}/command`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ ...(payload || {}), type, cmd: type })
  });
  checkUnauthorized(res);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Falha ao enviar comando ao equipamento');
  }
  return res.json();
};

// --- Auth ---
export const login = async (email: string, pass: string) => {
  const res = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ email, password: pass })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
};

export const loginWithGoogle = async (idToken: string) => {
  const res = await fetch(`${API_URL}/auth/google`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ idToken })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Google login failed');
  return data;
};

export const register = async (name: string, email: string, pass: string) => {
  const res = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ name, email, password: pass })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Server Error');
  }
  return true;
};

// --- Devices / Fermenters ---
export const fetchDevices = async (token?: string | null) => {
  const res = await fetch(`${API_URL}/devices`, {
    headers: getHeaders(token)
  });
  checkUnauthorized(res);
  if (!res.ok) throw new Error('Failed to fetch devices');
  return res.json();
};

export const updateChoppName = async (token: string, deviceId: string, choppName: string) => {
    const res = await fetch(`${API_URL}/devices/${encodeURIComponent(deviceId)}/chopp_name`, {
        method: 'PUT',
        headers: getHeaders(token),
        body: JSON.stringify({ choppName })
    });
    checkUnauthorized(res);
    if (!res.ok) throw new Error('Falha ao atualizar chopp');
    return res.json();
};

export const updateSensors = async (token: string, deviceId: string, sensor1Name: string, sensor2Name: string, sensorSgName: string) => {
    const res = await fetch(`${API_URL}/devices/${encodeURIComponent(deviceId)}/sensors`, {
        method: 'PUT',
        headers: getHeaders(token),
        body: JSON.stringify({ sensor1Name, sensor2Name, sensorSgName })
    });
    checkUnauthorized(res);
    if (!res.ok) throw new Error('Falha ao atualizar sensores');
    return res.json();
};

export const fetchBatches = async (token?: string | null) => {
  const res = await fetch(`${API_URL}/batches`, {
    headers: getHeaders(token)
  });
  checkUnauthorized(res);
  if (!res.ok) throw new Error('Failed to fetch batches');
  return res.json();
};

export const deleteBatch = async (id: string | number, token?: string | null) => {
  const res = await fetch(`${API_URL}/batches/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
    headers: getHeaders(token)
  });
  checkUnauthorized(res);
  if (!res.ok) throw new Error('Failed to delete batch');
  return res.json();
};

export const addDevice = async (serialCode: string, name: string) => {
  const res = await fetch(`${API_URL}/devices`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ serialCode, name })
  });
  checkUnauthorized(res);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to add device');
  }
  return true;
};

export const updateDevice = async (serialCode: string, name: string) => {
  const res = await fetch(`${API_URL}/devices/${encodeURIComponent(serialCode)}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ name })
  });
  checkUnauthorized(res);
  if (!res.ok) throw new Error('Failed to update device');
  return res.json();
};

export const deleteDevice = async (serialCode: string) => {
  const res = await fetch(`${API_URL}/devices/${encodeURIComponent(serialCode)}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  checkUnauthorized(res);
  if (!res.ok) throw new Error('Failed to delete device');
  return true;
};

// --- Batches ---
export const startBatch = async (serialCode: string, name: string, style: string, og: number, fg: number, profile?: any[], volume?: number, ingredients?: any) => {
  const res = await fetch(`${API_URL}/batch/start`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ serialCode, name, style, og, fg, volume, profile, ...(ingredients ? { ingredients } : {}) })
  });
  checkUnauthorized(res);
  if (!res.ok) throw new Error('Failed to start batch');
  return res.json();
};

// --- Saved Profiles / Recipes ---
export const fetchRecipes = async (token?: string | null) => {
  const res = await fetch(`${API_URL}/recipes`, {
    headers: getHeaders(token)
  });
  checkUnauthorized(res);
  if (!res.ok) throw new Error('Failed to fetch recipes');
  return res.json();
};

export const saveRecipe = async (recipe: { name: string; style?: string; og?: number; fg?: number; steps: any[] }, token?: string | null) => {
  const res = await fetch(`${API_URL}/recipes`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(recipe)
  });
  checkUnauthorized(res);
  if (!res.ok) throw new Error('Failed to save recipe');
  return res.json();
};

export const deleteRecipe = async (id: string | number, token?: string | null) => {
  const res = await fetch(`${API_URL}/recipes/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
    headers: getHeaders(token)
  });
  checkUnauthorized(res);
  if (!res.ok) throw new Error('Failed to delete recipe');
  return res.json();
};

export interface UserAlertConfig {
  lowBatteryEnabled: boolean;
  lowBatteryThreshold: number;
  tempDeviationEnabled: boolean;
  tempDeviationMargin: number;
  sgTargetEnabled: boolean;
  sgTargetValue: number | null;
  telegramBotToken: string;
  telegramChatId: string;
}

// --- External Integrations & Custom Alerts (Brewfather + Telegram + Alert Rules) ---
export const fetchIntegrations = async (token?: string | null) => {
  const res = await fetch(`${API_URL}/user/integrations`, {
    headers: getHeaders(token)
  });
  checkUnauthorized(res);
  if (!res.ok) throw new Error('Failed to fetch integrations');
  return res.json();
};

export const updateIntegrations = async (data: { brewfatherWebhookUrl?: string; alertConfig?: UserAlertConfig }, token?: string | null) => {
  const res = await fetch(`${API_URL}/user/integrations`, {
    method: 'PUT',
    headers: getHeaders(token),
    body: JSON.stringify(data)
  });
  checkUnauthorized(res);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Failed to save integrations');
  return body;
};

export const testBrewfatherWebhook = async (brewfatherWebhookUrl: string, deviceName?: string, token?: string | null) => {
  const res = await fetch(`${API_URL}/user/integrations/test-brewfather`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ brewfatherWebhookUrl, deviceName })
  });
  checkUnauthorized(res);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) throw new Error(body.error || 'Falha ao testar envio para o Brewfather');
  return body;
};

export const testTelegramWebhook = async (telegramBotToken: string, telegramChatId: string, token?: string | null) => {
  const res = await fetch(`${API_URL}/user/integrations/test-telegram`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ telegramBotToken, telegramChatId })
  });
  checkUnauthorized(res);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) throw new Error(body.error || 'Falha ao testar envio para o Telegram');
  return body;
};

export const stopBatch = async (serialCode: string) => {
  const res = await fetch(`${API_URL}/batch/stop`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ serialCode })
  });
  checkUnauthorized(res);
  if (!res.ok) throw new Error('Failed to stop batch');
  return true;
};

export const updateBatch = async (serialCode: string, updates: { og?: number, fg?: number, name?: string, profile?: any[] }) => {
  const body: any = { serialCode, ...updates };
  const res = await fetch(`${API_URL}/batch/update`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(body)
  });
  checkUnauthorized(res);
  if (!res.ok) throw new Error('Failed to update batch');
  return true;
};

// --- Events ---
export const fetchEvents = async (batchId: number) => {
  const res = await fetch(`${API_URL}/batch/${batchId}/events`, {
    headers: getHeaders()
  });
  checkUnauthorized(res);
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json();
};

export const fetchBatchData = async (batchId: number) => {
  const res = await fetch(`${API_URL}/batch/${batchId}/data`, {
    headers: getHeaders()
  });
  checkUnauthorized(res);
  if (!res.ok) throw new Error('Failed to fetch batch data');
  return res.json();
};

export const saveEvent = async (batchId: number, type: string, description: string, date: string) => {
  // Convert ISO to MySQL datetime format: YYYY-MM-DD HH:MM:SS
  const parsed = new Date(date);
  const d = isNaN(parsed.getTime()) ? new Date() : parsed;
  const sqlDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  
  const res = await fetch(`${API_URL}/events`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ batchId, type, description, date: sqlDate })
  });
  checkUnauthorized(res);
  if (!res.ok) throw new Error('Failed to save event');
  return true;
};

export const deleteEvent = async (eventId: string) => {
  const res = await fetch(`${API_URL}/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  checkUnauthorized(res);
  if (!res.ok) throw new Error('Failed to delete event');
  return true;
};

// --- Public Live Spectator Mode ---
export const generateBatchShareToken = async (batchId: number | string, options?: { revoke?: boolean; regenerate?: boolean }, token?: string | null) => {
  const res = await fetch(`${API_URL}/batches/${encodeURIComponent(String(batchId))}/share-token`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(options || {})
  });
  checkUnauthorized(res);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Failed to generate share link');
  return body as { publicToken: string | null };
};

export const fetchPublicBatch = async (publicToken: string) => {
  const res = await fetch(`${API_URL}/public/batch/${encodeURIComponent(publicToken)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Lote público não encontrado');
  return body;
};

export const fetchDiscoveryDevices = async (token?: string | null) => {
  const res = await fetch(`${API_URL}/discovery`, {
    headers: getHeaders(token)
  });
  checkUnauthorized(res);
  if (!res.ok) throw new Error('Falha ao buscar dispositivos na rede');
  return res.json();
};

export const fetchActiveBroadcast = async () => {
  const res = await fetch(`${API_URL}/broadcasts/active`);
  if (!res.ok) return null;
  return res.json();
};

export const requestPasswordReset = async (email: string) => {
  const res = await fetch(`${API_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Falha ao solicitar recuperação de senha');
  return body as { message: string };
};

export const confirmPasswordReset = async (email: string, code: string, newPassword: string) => {
  const res = await fetch(`${API_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), code: code.trim(), newPassword })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Falha ao redefinir senha');
  return body as { message: string };
};

// --- Virtual ESP32 Simulator API ---
export const fetchSimulatorStatus = async (token?: string | null) => {
  const res = await fetch(`${API_URL}/simulator/status`, {
    headers: getHeaders(token)
  });
  checkUnauthorized(res);
  if (!res.ok) throw new Error('Falha ao consultar estado do ESP32 Virtual');
  return res.json();
};

export const updateSimulatorState = async (patch: Record<string, any>, token?: string | null) => {
  const res = await fetch(`${API_URL}/simulator/update`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(patch)
  });
  checkUnauthorized(res);
  if (!res.ok) throw new Error('Falha ao atualizar ESP32 Virtual');
  return res.json();
};

export const triggerSimulatorDeviceAction = async (payload: { action: 'start_batch' | 'stop_batch'; name?: string; style?: string; profile?: any[] }, token?: string | null) => {
  const res = await fetch(`${API_URL}/simulator/device-action`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(payload)
  });
  checkUnauthorized(res);
  if (!res.ok) throw new Error('Falha ao disparar ação física do ESP32 Virtual');
  return res.json();
};

export const clearSimulatorCommandLog = async (token?: string | null) => {
  const res = await fetch(`${API_URL}/simulator/clear-log`, {
    method: 'POST',
    headers: getHeaders(token)
  });
  checkUnauthorized(res);
  if (!res.ok) throw new Error('Falha ao limpar log de comandos');
  return res.json();
};

export const linkSimulatorDevice = async (options?: { serial?: string; unlink?: boolean }, token?: string | null) => {
  const res = await fetch(`${API_URL}/simulator/link-device`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(options || {})
  });
  checkUnauthorized(res);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Falha ao vincular ESP32 Virtual');
  return body as { linked: boolean; serial: string; message: string };
};
