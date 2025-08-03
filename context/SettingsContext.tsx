
import React, { createContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SettingsContextType = {
  notificationsEnabled: boolean;
  toggleNotifications: () => void;
  azanEnabled: boolean;
  toggleAzan: () => void;
  isLoading: boolean;
};

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

type SettingsProviderProps = {
  children: ReactNode;
};

const SETTINGS_STORAGE_KEY = '@easy_adhan_settings';

type StoredSettings = {
  notificationsEnabled: boolean;
  azanEnabled: boolean;
};

export const SettingsProvider = ({ children }: SettingsProviderProps) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [azanEnabled, setAzanEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from storage on app start
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (storedSettings) {
          const parsedSettings: StoredSettings = JSON.parse(storedSettings);
          setNotificationsEnabled(parsedSettings.notificationsEnabled);
          setAzanEnabled(parsedSettings.azanEnabled);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        // Keep default values if loading fails
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Save settings to storage whenever they change
  const saveSettings = async (newSettings: StoredSettings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const toggleNotifications = () => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    saveSettings({
      notificationsEnabled: newValue,
      azanEnabled,
    });
  };

  const toggleAzan = () => {
    const newValue = !azanEnabled;
    setAzanEnabled(newValue);
    saveSettings({
      notificationsEnabled,
      azanEnabled: newValue,
    });
  };

  return (
    <SettingsContext.Provider 
      value={{ 
        notificationsEnabled, 
        toggleNotifications, 
        azanEnabled, 
        toggleAzan,
        isLoading 
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};
