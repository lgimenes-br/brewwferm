/// <reference types="vite/client" />
export const API_URL = import.meta.env.VITE_API_URL || 'https://breww.live/api';

// O navegador nao se conecta mais ao broker MQTT: dados ao vivo chegam por /api/live (SSE)
// e comandos por POST /api/devices/:serial/command, ambos autenticados.
