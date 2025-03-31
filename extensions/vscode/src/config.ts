import { config } from 'dotenv';

export interface Config {
    apiUrl: string;
}

export function getConfig(): Config {
    // Try to load from .env file if it exists
    try {
        // In production, this should resolve to the extension's installed directory
        const env = config();
        if (env.parsed?.API_URL) {
            return {
                apiUrl: env.parsed.API_URL
            };
        }
    } catch (e) {
        // .env file doesn't exist or couldn't be loaded
    }

    // Fallback to default values
    return {
        apiUrl: process.env.NODE_ENV === 'development' 
            ? 'http://localhost:8080'
            : 'https://api.ariana.dev/'
    };
}