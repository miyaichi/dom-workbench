// SettingsPanel.tsx
import React from 'react';
import {
  LogLevel,
  PaperOrientation,
  PaperSettings,
  PaperSize,
  ShareFormat,
  useSettings,
} from '../../lib/settings';

export const SettingsPanel: React.FC = () => {
  const { settings, updateSettings, loading, error } = useSettings();

  if (error) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Settings Error</h2>
        </div>
        <div className="error-message">Failed to load settings: {error}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Settings</h2>
        </div>
        <div className="loading-message">Loading settings...</div>
      </div>
    );
  }

  const handlePaperSettingChange = (
    key: keyof PaperSettings,
    value: PaperSize | PaperOrientation
  ) => {
    updateSettings({
      paper: {
        ...settings.paper,
        [key]: value,
      },
    });
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Settings</h2>
      </div>
      <div className="card-content">
        <div className="setting-group">
          <label>Share Format</label>
          <select
            value={settings.shareFormat}
            onChange={(e) => updateSettings({ shareFormat: e.target.value as ShareFormat })}
          >
            <option value="pdf">PDF</option>
            <option value="ppt">PPT</option>
          </select>
        </div>

        <div className="setting-group">
          <label>Paper Size</label>
          <select
            value={settings.paper.size}
            onChange={(e) => handlePaperSettingChange('size', e.target.value as PaperSize)}
          >
            <option value="a4">A4</option>
            <option value="presentation-16-9">Presentation (16:9)</option>
          </select>
        </div>

        <div className="setting-group">
          <label>Paper Orientation</label>
          <select
            value={settings.paper.orientation}
            onChange={(e) =>
              handlePaperSettingChange('orientation', e.target.value as PaperOrientation)
            }
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </div>
      </div>

      <div className="setting-group">
        <label>Log Level</label>
        <select
          value={settings.logLevel}
          onChange={(e) => updateSettings({ logLevel: e.target.value as LogLevel })}
        >
          <option value="error">Error</option>
          <option value="warn">Warning</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </select>
      </div>
    </div>
  );
};
