export const ENV = {
    // API and Backend Services
    API_URL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
    
    // MQTT configuration (if different from VITE_MQTT_BROKER)
    MQTT_BROKER: import.meta.env.VITE_MQTT_BROKER || 'ws://192.168.68.109:9001',
    
    // Feature Flags / System configs
    IS_PRODUCTION: import.meta.env.PROD || false,
    IS_DEVELOPMENT: import.meta.env.DEV || true,

    // App Version
    APP_VERSION: import.meta.env.VITE_APP_VERSION || '2.4.0'
} as const;

export default ENV;
