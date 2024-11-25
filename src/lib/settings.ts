// src/lib/settings.ts
import { useEffect, useState } from 'react';

/** Represents the available log levels for the application */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/** Represents the available formats for sharing content */
export type ShareFormat = 'pdf' | 'ppt';

/**
 * Interface representing the application settings
 */
export interface Settings {
  /** The log level for the application */
  logLevel: LogLevel;
  /** The format for sharing (either 'pdf' or 'ppt') */
  shareFormat: ShareFormat;
}

/**
 * The default settings for the application
 */
export const defaultSettings: Settings = {
  logLevel: 'info',
  shareFormat: 'ppt',
};

/**
 * Loads the settings from Chrome storage
 * @returns A promise that resolves to the loaded settings
 */
export const loadSettings = async (): Promise<Settings> => {
  if (!chrome.storage || !chrome.storage.sync) {
    console.warn('Chrome storage API not available, using default settings');
    return defaultSettings;
  }

  try {
    const result = await chrome.storage.sync.get('settings');
    if (!result.settings) {
      await saveSettings(defaultSettings);
      return defaultSettings;
    }
    return result.settings as Settings;
  } catch (error) {
    console.error('Failed to load settings:', error);
    return defaultSettings;
  }
};

/**
 * Saves the settings to Chrome storage
 * @param settings - The settings to save
 */
export const saveSettings = async (settings: Settings): Promise<void> => {
  if (!chrome.storage || !chrome.storage.sync) {
    console.warn('Chrome storage API not available, settings will not persist');
    return;
  }

  try {
    await chrome.storage.sync.set({ settings });
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
};

/**
 * Custom React hook to manage settings state
 * @returns An object containing the settings state and management functions
 */
export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeSettings = async () => {
      try {
        const savedSettings = await loadSettings();
        setSettings(savedSettings);
      } catch (err) {
        setError((err as Error).message);
        console.error('Failed to initialize settings:', err);
      } finally {
        setLoading(false);
      }
    };

    initializeSettings();

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.settings?.newValue) {
        setSettings(changes.settings.newValue);
      }
    };

    if (chrome.storage?.sync) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      };
    }
  }, []);

  const updateSettings = async (newSettings: Partial<Settings>) => {
    try {
      const updatedSettings = {
        ...settings,
        ...newSettings,
      };
      await saveSettings(updatedSettings);
      setSettings(updatedSettings);
    } catch (err) {
      setError((err as Error).message);
      console.error('Failed to update settings:', err);
    }
  };

  return {
    /** Current application settings */
    settings,
    /** Function to update settings with partial changes */
    updateSettings,
    /** Indicates if settings are currently being loaded */
    loading,
    /** Error message if settings operations failed */
    error,
  };
};
