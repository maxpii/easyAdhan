
import React, { createContext, useState, ReactNode } from 'react';

type SettingsContextType = {
  notificationsEnabled: boolean;
  toggleNotifications: () => void;
  azanEnabled: boolean;
  toggleAzan: () => void;
};

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

type SettingsProviderProps = {
  children: ReactNode;
};

export const SettingsProvider = ({ children }: SettingsProviderProps) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [azanEnabled, setAzanEnabled] = useState(true);

  const toggleNotifications = () => {
    setNotificationsEnabled(previousState => !previousState);
  };

  const toggleAzan = () => {
    setAzanEnabled(previousState => !previousState);
  };

  return (
    <SettingsContext.Provider value={{ notificationsEnabled, toggleNotifications, azanEnabled, toggleAzan }}>
      {children}
    </SettingsContext.Provider>
  );
};
