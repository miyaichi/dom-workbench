// src/App.tsx
import { Camera, Power, Settings } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
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
import { getContentScriptContext } from '../utils/contextHelpers';
import './App.css';

const logger = new Logger('SidePanel');

export const App = () => {
  const [currentTabId, setCurrentTabId] = useState<number | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShareCapture, setShowShareCapture] = useState(false);
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [captureUrl, setCaptureDataUrl] = useState<string | null>(null);
  const [styleModifications, setStyleModifications] = useState<StyleModification[]>([]);
  const { sendMessage, subscribe } = useConnectionManager('sidepanel');

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        setCurrentTabId(tab.id);
      }
    });
  }, []);

  const handleTabActivated = useCallback(
    async (message: { payload: { tabId: number } }) => {
      const { tabId } = message.payload;
      logger.debug('Tab activated with ID:', tabId);
      setCurrentTabId(tabId);
      const contentScriptContext = getContentScriptContext(tabId);
      await sendMessage('GET_CONTENT_STATE', undefined, contentScriptContext);
    },
    [sendMessage]
  );

  const handleContentStateUpdate = useCallback((message: any) => {
    const { isSelectionMode, selectedElementInfo } = message.payload;
    setIsSelectionMode(isSelectionMode);
    setSelectedElement(selectedElementInfo);
  }, []);

  const handleElementSelected = useCallback(
    (message: { payload: { elementInfo: ElementInfo } }) => {
      logger.log('Element selected:', message.payload.elementInfo);
      setSelectedElement(message.payload.elementInfo);
    },
    []
  );

  const handleElementUnselected = useCallback(() => {
    logger.log('Element unselected');
    setSelectedElement(null);
  }, []);

  const handleCaptureResult = useCallback((message: any) => {
    logger.log('Capture result:', message.payload);
    const { success, imageDataUrl, error, url } = message.payload;

    if (success) {
      setImageDataUrl(imageDataUrl || null);
      setCaptureDataUrl(url || '');
    } else {
      logger.error('Capture failed:', error);
    }
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logger.log('Document hidden, cleaning up');
        setShowSettings(false);
        setShowShareCapture(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const subscriptions = new Map();

    if (mounted) {
      subscriptions.set('TAB_ACTIVATED', subscribe('TAB_ACTIVATED', handleTabActivated));
      subscriptions.set(
        'CONTENT_STATE_UPDATE',
        subscribe('CONTENT_STATE_UPDATE', handleContentStateUpdate)
      );
      subscriptions.set('ELEMENT_SELECTED', subscribe('ELEMENT_SELECTED', handleElementSelected));
      subscriptions.set(
        'ELEMENT_UNSELECTED',
        subscribe('ELEMENT_UNSELECTED', handleElementUnselected)
      );
      subscriptions.set('CAPTURE_TAB_RESULT', subscribe('CAPTURE_TAB_RESULT', handleCaptureResult));
    }

    return () => {
      mounted = false;
      subscriptions.forEach((unsubscribe) => unsubscribe());
      subscriptions.clear();
    };
  }, [
    handleTabActivated,
    handleContentStateUpdate,
    handleElementSelected,
    handleElementUnselected,
    handleCaptureResult,
  ]);

  const handleCapture = () => {
    if (!currentTabId) return;
    setShowShareCapture(true);
    sendMessage('CAPTURE_TAB', undefined, 'background');
  };

  const handleShareClose = () => {
    setShowShareCapture(false);
  };

  const handleStylesChange = (modifications: StyleModification[]) => {
    setStyleModifications(modifications);
  };

  const handleOnSelectElement = (path: number[]) => {
    if (!currentTabId) return;
    const contentScriptContext = getContentScriptContext(currentTabId);
    sendMessage('SELECT_ELEMENT', { path }, contentScriptContext);
  };

  const toggleSelectionMode = async () => {
    if (!currentTabId) return;
    const enabled = !isSelectionMode;
    setIsSelectionMode(enabled);
    const contentScriptContext = getContentScriptContext(currentTabId);
    await sendMessage('TOGGLE_SELECTION_MODE', { enabled }, contentScriptContext);
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
