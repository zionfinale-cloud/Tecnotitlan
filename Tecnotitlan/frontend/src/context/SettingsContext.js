import React, { createContext, useState, useEffect } from 'react';
// Asumimos que apiService.js existe en src/services/
import api from '../services/apiService'; 

// Valores por defecto: Aseguran que la aplicación siempre se vea bien incluso sin conexión.
export const SettingsContext = createContext({
    settings: {
        siteName: 'Tecnotitlan',
        logoUrl: '/images/logo.png', // Debe estar en frontend/public/images/
        accentColor: '#00DC82', // Verde Neón (Valor por defecto de index.css)
        currencySymbol: '$', // Símbolo de moneda
    },
    loading: false, // Indica si la carga inicial ha terminado
    updateSettings: () => {}
});

export const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState({
        siteName: 'Tecnotitlan',
        logoUrl: '/images/logo.png',
        accentColor: '#00DC82',
        currencySymbol: '$',
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                // Cargar configuración de la API (endpoint público)
                const { data } = await api.get('/settings');
                
                if (data.data.settings) {
                    const newSettings = data.data.settings;
                    setSettings(prev => ({ ...prev, ...newSettings }));
                    
                    // CRÍTICO: Aplicar el color de acento al CSS Root (index.css)
                    if (newSettings.accentColor) {
                        document.documentElement.style.setProperty('--cta-color', newSettings.accentColor);
                    }
                }
            } catch (error) {
                console.warn("Usando configuración por defecto (Error API):", error.message);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const updateSettings = (newSettings) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
        
        // Aplicar el color inmediatamente en el frontend si se actualiza
        if (newSettings.accentColor) {
            document.documentElement.style.setProperty('--cta-color', newSettings.accentColor);
        }
    };

    return (
        <SettingsContext.Provider value={{ settings, loading, updateSettings }}>
            {children}
        </SettingsContext.Provider>
    );
};