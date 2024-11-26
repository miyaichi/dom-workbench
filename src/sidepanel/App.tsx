import { Camera, Power, Settings } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { DOMSelector } from '../components/DOMSelector';
import { SettingsPanel } from '../components/SettingsPanel';
import { ShareCapture } from '../components/ShareCapture';
import { StyleEditor } from '../components/StyleEditor';
import { TagInjector } from '../components/TagInjector';
import { Tooltip } from '../components/Tooltip';
import { useConnectionManager } from '../lib/connectionManager';
import { Logger } from '../lib/logger';
import '../styles/common.css';
import { ElementInfo, StyleModification } from '../types/domSelection';
import './App.css';

const logger = new Logger('SidePanel');

export const App = () => {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShareCapture, setShowShareCapture] = useState(false);
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [captureUrl, setCaptureDataUrl] = useState<string | null>(null);
  const [styleModifications, setStyleModifications] = useState<StyleModification[]>([]);
  const { sendMessage, subscribe } = useConnectionManager();

  // Cleanup
  const cleanup = () => {
    logger.log('Cleaning up');
    setSelectedElement(null);
    setIsSelectionMode(false);
    sendMessage('TOGGLE_SELECTION_MODE', { enabled: false });
    if (showSettings) {
      setShowSettings(false);
    }
    if (showShareCapture) {
      setShowShareCapture(false);
    }
  };

  // Monitor visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logger.log('Document hidden, cleaning up');
        cleanup();
      }
    };

    logger.log('Monitoring visibility change');
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }, [isSelectionMode, showSettings]);

  // Message subscriptions
  useEffect(() => {
    const subscriotions = [
      subscribe('TAB_ACTIVATED', () => {
        logger.log('Tab activated, cleaning up');
        cleanup();
      }),

      subscribe('ELEMENT_SELECTED', (message: { payload: { elementInfo: ElementInfo } }) => {
        logger.log('Element selected:', message.payload.elementInfo);
        setSelectedElement(message.payload.elementInfo);
      }),

      subscribe('ELEMENT_UNSELECTED', () => {
        logger.log('Element unselected');
        setSelectedElement(null);
      }),

      subscribe('CAPTURE_TAB_RESULT', (message) => {
        logger.log('Capture result:', message.payload);
        const { success, imageDataUrl, error, url } = message.payload;

        if (success) {
          setImageDataUrl(imageDataUrl || null);
          setCaptureDataUrl(url || '');
        } else {
          logger.error('Capture failed:', error);
        }
      }),
    ];

    // Clean up subscriptions
    return () => {
      subscriotions.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  const handleCapture = () => {
    setShowShareCapture(true);
    sendMessage('CAPTURE_TAB', undefined);
  };

  const handleShareClose = () => {
    setShowShareCapture(false);
  };

  const handleStylesChange = (modifications: StyleModification[]) => {
    setStyleModifications(modifications);
  };

  const handleOnSelectElement = (path: number[]) => {
    sendMessage('SELECT_ELEMENT', { path });
  };

  const toggleSelectionMode = () => {
    const enabled = !isSelectionMode;
    setIsSelectionMode(enabled);
    sendMessage('TOGGLE_SELECTION_MODE', { enabled: enabled });
  };

  return (
    <div className="app-container">
      <div className="app-content">
        <div className="app-header">
          <button
            onClick={toggleSelectionMode}
            className={`selection-button ${isSelectionMode ? 'enabled' : 'disabled'}`}
          >
            <Power size={16} />
            {isSelectionMode ? 'Selection Mode On' : 'Selection Mode Off'}
          </button>

          <div className="header-actions">
            <Tooltip content={chrome.i18n.getMessage('tooltipCapture')}>
              <button onClick={handleCapture} className="icon-button">
                <Camera size={16} />
              </button>
            </Tooltip>
            <Tooltip content={chrome.i18n.getMessage('tooltipSettings')}>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`icon-button ${showSettings ? 'active' : ''}`}
              >
                <Settings size={16} />
              </button>
            </Tooltip>
          </div>
        </div>

        {showSettings ? (
          <SettingsPanel />
        ) : (
          <div className="components-container">
            <DOMSelector
              selectedElement={selectedElement}
              onSelectElement={handleOnSelectElement}
            />
            {showShareCapture && (
              <ShareCapture
                onClose={handleShareClose}
                selectedElement={selectedElement}
                imageDataUrl={imageDataUrl}
                captureUrl={captureUrl}
                styleModifications={styleModifications}
              />
            )}
            <StyleEditor selectedElement={selectedElement} onStylesChange={handleStylesChange} />
            <TagInjector selectedElement={selectedElement} />
          </div>
        )}
      </div>
    </div>
  );
};
