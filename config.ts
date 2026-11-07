/// <reference types="vite/client" />
export const API_URL = import.meta.env.VITE_API_URL || 'https://breww.live/api';

export const MQTT_BROKER = import.meta.env.VITE_MQTT_BROKER || 'wss://breww.live/mqtt';
export const MQTT_USER = import.meta.env.VITE_MQTT_USER || 'esp32user';
export const MQTT_PASSWORD = import.meta.env.VITE_MQTT_PASSWORD || 'esp32';
