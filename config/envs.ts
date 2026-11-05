import { API_URL, MQTT_BROKER } from '../config';

export const ENV = {
    // API and Backend Services
    API_URL,
    
    // MQTT configuration
    MQTT_BROKER,
    
    // Feature Flags / System configs
    IS_PRODUCTION: import.meta.env.PROD || false,
    IS_DEVELOPMENT: import.meta.env.DEV || true,

    // App Version
    APP_VERSION: import.meta.env.VITE_APP_VERSION || '2.4.0'
} as const;

export default ENV;
