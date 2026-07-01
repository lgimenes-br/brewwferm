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

// --- Auth ---
export const login = async (email: string, pass: string) => {
  const res = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ email, password: pass })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
};

export const loginWithGoogle = async (idToken: string) => {
  const res = await fetch(`${API_URL}/auth/google`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ idToken })
  });
  const data = await res.json();
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
    const data = await res.json();
    throw new Error(data.error || 'Server Error');
  }
  return true;
};

// --- Devices / Fermenters ---
export const fetchDevices = async (token?: string | null) => {
  const res = await fetch(`${API_URL}/devices`, {
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error('Failed to fetch devices');
  return res.json();
};

export const updateSensors = async (token: string, deviceId: string, sensor1Name: string, sensor2Name: string, sensorSgName: string) => {
    const res = await fetch(`${API_URL}/devices/${deviceId}/sensors`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sensor1Name, sensor2Name, sensorSgName })
    });
    if (!res.ok) throw new Error('Falha ao atualizar sensores');
    return res.json();
};

export const fetchBatches = async (token?: string | null) => {
  const res = await fetch(`${API_URL}/batches`, {
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error('Failed to fetch batches');
  return res.json();
};

export const deleteBatch = async (id: string | number, token?: string | null) => {
  const res = await fetch(`${API_URL}/batches/${id}`, {
    method: 'DELETE',
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error('Failed to delete batch');
  return res.json();
};

export const addDevice = async (serialCode: string, name: string) => {
  const res = await fetch(`${API_URL}/devices`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ serialCode, name })
  });
  if (!res.ok) throw new Error('Failed to add device');
  return true;
};

export const deleteDevice = async (serialCode: string) => {
  const res = await fetch(`${API_URL}/devices/${serialCode}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete device');
  return true;
};

// --- Batches ---
export const startBatch = async (serialCode: string, name: string, style: string, og: number, fg: number, profile?: any[]) => {
  const res = await fetch(`${API_URL}/batch/start`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ serialCode, name, style, og, fg, profile })
  });
  if (!res.ok) throw new Error('Failed to start batch');
  return true;
};

export const stopBatch = async (serialCode: string) => {
  const res = await fetch(`${API_URL}/batch/stop`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ serialCode })
  });
  if (!res.ok) throw new Error('Failed to stop batch');
  return true;
};

export const finishBatch = async (batchId: number) => {
  const res = await fetch(`${API_URL}/batch/${batchId}/finish`, {
    method: 'POST',
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to finish batch');
  return true;
};

export const updateBatch = async (serialCode: string, updates: { og?: number, fg?: number, name?: string, profile?: any[] }) => {
  const body: any = { serialCode, ...updates };
  const res = await fetch(`${API_URL}/batch/update`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('Failed to update batch');
  return true;
};

// --- Events ---
export const fetchEvents = async (batchId: number) => {
  const res = await fetch(`${API_URL}/batch/${batchId}/events`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json();
};

export const fetchBatchData = async (batchId: number) => {
  const res = await fetch(`${API_URL}/batch/${batchId}/data`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch batch data');
  return res.json();
};

export const saveEvent = async (batchId: number, type: string, description: string, date: string) => {
  // Convert ISO to MySQL datetime format: YYYY-MM-DD HH:MM:SS
  const d = new Date(date);
  const sqlDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  
  const res = await fetch(`${API_URL}/events`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ batchId, type, description, date: sqlDate })
  });
  if (!res.ok) throw new Error('Failed to save event');
  return true;
};

export const deleteEvent = async (eventId: string) => {
  const res = await fetch(`${API_URL}/events/${eventId}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete event');
  return true;
};
