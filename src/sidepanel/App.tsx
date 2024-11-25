import { Camera, Power, Settings } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { DOMSelector } from '../components/DOMSelector';
import { SettingsPanel } from '../components/SettingsPanel';
import { ShareCapture } from '../components/ShareCapture';
import { StyleEditor } from '../components/StyleEditor';
import { Tooltip } from '../components/Tooltip';
import { useConnectionManager } from '../lib/connectionManager';
import { Logger } from '../lib/logger';
import '../styles/common.css';
import {
  BROWSER_EVENTS,
  DOM_SELECTION_EVENTS,
  ElementInfo,
  StyleModification,
  UI_EVENTS,
} from '../types/domSelection';
import './App.css';

const logger = new Logger('SidePanel');

export const App = () => {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShareCapture, setShowShareCapture] = useState(false);
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const [styleModifications, setStyleModifications] = useState<StyleModification[]>([]);
  const { sendMessage, subscribe } = useConnectionManager();

  // Cleanup
  const cleanup = () => {
    logger.log('Cleaning up');
    if (isSelectionMode) {
      setIsSelectionMode(false);
      sendMessage(DOM_SELECTION_EVENTS.TOGGLE_SELECTION_MODE, {
        enabled: false,
      });
      sendMessage(DOM_SELECTION_EVENTS.CLEAR_SELECTION, {
        timestamp: Date.now(),
      });
      setSelectedElement(null);
    }

    if (showSettings) {
      setShowSettings(false);
    }

    if (showShareCapture) {
      setShowShareCapture(false);
    }

    sendMessage(UI_EVENTS.SIDE_PANEL_CLOSED, { timestamp: Date.now() });
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

    // Monitor connection to the Chrome extension
    const port = chrome.runtime.connect({ name: 'sidepanel' });
    port.onDisconnect.addListener(cleanup);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      port.disconnect();
    };
  }, [isSelectionMode, showSettings]);

  // Message subscriptions
  useEffect(() => {
    const subscriotions = [
      subscribe(
        DOM_SELECTION_EVENTS.ELEMENT_SELECTED,
        (message: { payload: { elementInfo: ElementInfo } }) => {
          logger.log('Element selected:', message.payload.elementInfo);
          setSelectedElement(message.payload.elementInfo);
        }
      ),

      subscribe(DOM_SELECTION_EVENTS.ELEMENT_UNSELECTED, () => {
        logger.log('Element unselected');
        setSelectedElement(null);
      }),

      subscribe(BROWSER_EVENTS.TAB_ACTIVATED, () => {
        logger.log('Tab activated, cleaning up');
        cleanup();
      }),

      subscribe(BROWSER_EVENTS.TAB_UPDATED, () => {
        logger.log('Tab updated, cleaning up');
        cleanup();
      }),
    ];

    // Clean up subscriptions
    return () => {
      subscriotions.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  const handleCapture = () => {
    setShowShareCapture(true);
    sendMessage(UI_EVENTS.CAPTURE_TAB, { timestamp: Date.now() });
  };

  const handleShareClose = () => {
    setShowShareCapture(false);
  };

  const handleStylesChange = (modifications: StyleModification[]) => {
    setStyleModifications(modifications);
  };

  const toggleSelectionMode = () => {
    const newMode = !isSelectionMode;
    if (!newMode) {
      sendMessage(DOM_SELECTION_EVENTS.CLEAR_SELECTION, {
        timestamp: Date.now(),
      });
    }
    setIsSelectionMode(newMode);
    sendMessage(DOM_SELECTION_EVENTS.TOGGLE_SELECTION_MODE, {
      enabled: newMode,
    });
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
            <DOMSelector />
            {showShareCapture && (
              <ShareCapture
                onClose={handleShareClose}
                initialSelectedElement={selectedElement}
                styleModifications={styleModifications}
              />
            )}
            <StyleEditor onStylesChange={handleStylesChange} />
          </div>
        )}
      </div>
    </div>
  );
};
