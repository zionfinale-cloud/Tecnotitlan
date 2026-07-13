import React, { createContext, useState, useEffect } from 'react';
// Asumimos que apiService.js existe en src/services/
import api from '../services/apiService'; 

// Valores por defecto: Aseguran que la aplicación siempre se vea bien incluso sin conexión.
export const SettingsContext = createContext({
    settings: {
        siteName: 'Tecnotitlan',
        contact_email: 'hola@tecnotitlan.com.mx',
        social_facebook: 'https://www.facebook.com/profile.php?id=61591872000643',
        social_tiktok: 'https://www.tiktok.com/@tecnotitlan_mx',
        social_whatsapp: 'https://wa.me/523481510949',
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
        contact_email: 'hola@tecnotitlan.com.mx',
        social_facebook: 'https://www.facebook.com/profile.php?id=61591872000643',
        social_tiktok: 'https://www.tiktok.com/@tecnotitlan_mx',
        social_whatsapp: 'https://wa.me/523481510949',
        logoUrl: '/images/logo.png',
        accentColor: '#00DC82',
        currencySymbol: '$',
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                // Cargar configuración de la API (endpoint público)
                const { data } = await api.get('/settings/public');
                
                if (Array.isArray(data.data)) {
                    const keyMap = {
                        site_name: 'siteName',
                        logo_url: 'logoUrl',
                        accent_color: 'accentColor',
                        currency_symbol: 'currencySymbol',
                    };
                    const newSettings = data.data.reduce((result, setting) => {
                        result[keyMap[setting.key] || setting.key] = setting.value;
                        return result;
                    }, {});
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
