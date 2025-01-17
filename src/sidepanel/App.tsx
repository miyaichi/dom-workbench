import { Camera, Power, Settings } from 'lucide-react';
import { nanoid } from 'nanoid';
import React, { useCallback, useEffect, useState } from 'react';
import { ConnectionManager } from '../lib/connectionManager';
import { Logger } from '../lib/logger';
import { BaseMessage, MessagePayloads, TabInfo } from '../types/messages';
import { Context, ElementInfo } from '../types/types';
import { DOMSelector } from './components/DOMSelector';
import { SettingsPanel } from './components/SettingsPanel';
import { ShareCapture } from './components/ShareCapture';
import { StyleEditor } from './components/StyleEditor';
import { TagInjector } from './components/TagInjector';
import { ToastNotification } from './components/common/ToastNotification';
import { Tooltip } from './components/common/Tooltip';

interface Toast {
  id: string;
  message: string;
  type?: 'success' | 'error';
}

interface InjectedTagInfo {
  id: string;
  tag: string;
  timestamp: number;
}

interface StyleChange {
  id: string;
  timestamp: number;
  property: keyof CSSStyleDeclaration;
  oldValue: string;
  newValue: string;
}

interface AppState {
  isSelectionMode: boolean;
  showSettings: boolean;
  showShareCapture: boolean;
  selectedElement: ElementInfo | null;
  imageDataUrl: string | null;
  captureUrl: string | null;
  toast: Toast | null;
  injectedTags: InjectedTagInfo[];
  styleChanges: StyleChange[];
}

const initialState: AppState = {
  isSelectionMode: false,
  showSettings: false,
  showShareCapture: false,
  selectedElement: null,
  imageDataUrl: null,
  captureUrl: null,
  toast: null,
  injectedTags: [],
  styleChanges: [],
};

const resetState = (): AppState => ({ ...initialState });

const logger = new Logger('sidepanel');

export default function App() {
  const [tabId, setTabId] = useState<number | null>(null);
  const [connectionManager, setConnectionManager] = useState<ConnectionManager | null>(null);
  const [contentScriptContext, setContentScriptContext] = useState<Context>('undefined');
  const initialized = React.useRef(false);
  const [state, setState] = useState<AppState>(resetState());

  useEffect(() => {
    if (initialized.current) {
      logger.debug('App already initialized, skipping...');
      return;
    }

    const initializeTab = async () => {
      if (initialized.current) return;

      try {
        const manager = new ConnectionManager('sidepanel', handleMessage);
        manager.connect();
        setConnectionManager(manager);

        // Initialize active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          setTabId(tab.id);
          initialized.current = true;
        }

        logger.debug('Initialized', { tab });
      } catch (error) {
        logger.error('Tab initialization failed:', error);
      }
    };

    initializeTab();

    // Monitor storage changes
    chrome.storage.local.onChanged.addListener((changes) => {
      const { activeTabInfo } = changes;
      const newTab = activeTabInfo?.newValue as TabInfo | undefined;
      if (!newTab) return;

      logger.debug('Tab info change detected from storage:', newTab);
      setTabId(newTab.tabId);
      setState(resetState());
    });
  }, []);

  useEffect(() => {
    // Update content script context
    const newContentScriptContext: Context = tabId ? `content-${tabId}` : 'undefined';
    setContentScriptContext(newContentScriptContext);

    // Reset state when tab changes
    setState(resetState());

    if (newContentScriptContext !== 'undefined') {
      // Reset contentScript state
      connectionManager?.sendMessage(newContentScriptContext, {
        type: 'TOGGLE_SELECTION_MODE',
        payload: { enabled: false } as MessagePayloads['TOGGLE_SELECTION_MODE'],
      });
    }
  }, [tabId, connectionManager]);

  // Event handlers
  const handleMessage = (message: BaseMessage) => {
    logger.debug('Message received', { type: message.type });
    switch (message.type) {
      case 'CAPTURE_TAB_RESULT': {
        const payload = message.payload as MessagePayloads['CAPTURE_TAB_RESULT'];
        if (payload.success) {
          setState((prev) => ({
            ...prev,
            imageDataUrl: payload.imageDataUrl || null,
            captureUrl: payload.url || '',
          }));
        } else {
          setState((prev) => ({
            ...prev,
            showShareCapture: false,
            toast: {
              id: Date.now().toString(),
              message: chrome.i18n.getMessage('toastCaptureFailed'),
              type: 'error',
            },
          }));
        }
        break;
      }
      case 'ELEMENT_SELECTED': {
        const payload = message.payload as MessagePayloads['ELEMENT_SELECTED'];
        setState((prev) => ({
          ...prev,
          selectedElement: payload.elementInfo,
        }));
        break;
      }
      case 'ELEMENT_UNSELECTED': {
        setState((prev) => ({
          ...prev,
          selectedElement: null,
        }));
        break;
      }
      case 'SHOW_TOAST': {
        const showToastPayload = message.payload as MessagePayloads['SHOW_TOAST'];
        setState((prev) => ({
          ...prev,
          toast: {
            id: Date.now().toString(),
            message: showToastPayload.message,
            type: showToastPayload.type,
          },
        }));
        break;
      }
    }
  };

  // UI event handlers
  const uiHandlers = {
    handleCapture: useCallback(() => {
      if (!tabId) return;
      setState((prev) => ({ ...prev, showShareCapture: true }));

      connectionManager?.sendMessage('background', {
        type: 'CAPTURE_TAB',
        payload: undefined as MessagePayloads['CAPTURE_TAB'],
      });
    }, [tabId, connectionManager]),

    handleShareClose: useCallback(() => {
      setState((prev) => ({ ...prev, showShareCapture: false }));
    }, []),

    handleSelectElement: useCallback(
      (path: number[]) => {
        if (!tabId) return;

        connectionManager?.sendMessage(contentScriptContext, {
          type: 'SELECT_ELEMENT',
          payload: { path } as MessagePayloads['SELECT_ELEMENT'],
        });
      },
      [tabId, connectionManager, contentScriptContext]
    ),

    toggleSelectionMode: useCallback(async () => {
      if (!tabId) return;

      const enabled = !state.isSelectionMode;
      connectionManager?.sendMessage(contentScriptContext, {
        type: 'TOGGLE_SELECTION_MODE',
        payload: { enabled: enabled },
      });

      setState((prev) => ({
        ...prev,
        isSelectionMode: enabled,
      }));
    }, [state.isSelectionMode, tabId, connectionManager, contentScriptContext]),

    handleStyleChange: useCallback(
      (property: string, value: string, oldValue: string) => {
        if (!tabId || !state.selectedElement) return;

        const changeEntry: StyleChange = {
          id: nanoid(),
          timestamp: Date.now(),
          property: property as keyof CSSStyleDeclaration,
          oldValue,
          newValue: value,
        };

        setState((prev) => ({
          ...prev,
          styleChanges: [changeEntry, ...prev.styleChanges],
        }));
        connectionManager?.sendMessage(contentScriptContext, {
          type: 'UPDATE_ELEMENT_STYLE',
          payload: { property: property, value: value } as MessagePayloads['UPDATE_ELEMENT_STYLE'],
        });
      },
      [state.selectedElement, tabId, connectionManager, contentScriptContext]
    ),

    handleUndoStyleChange: useCallback(() => {
      if (!tabId || state.styleChanges.length === 0) return;

      const latestChange = state.styleChanges[0];
      connectionManager?.sendMessage(contentScriptContext, {
        type: 'UPDATE_ELEMENT_STYLE',
        payload: {
          property: latestChange.property,
          value: latestChange.oldValue,
        } as MessagePayloads['UPDATE_ELEMENT_STYLE'],
      });

      setState((prev) => ({
        ...prev,
        styleChanges: prev.styleChanges.slice(1),
      }));
    }, [state.styleChanges, tabId, connectionManager, contentScriptContext]),

    handleTagInject: useCallback(
      async (tag: string, tagId: string) => {
        if (!tabId) return;

        connectionManager?.sendMessage(contentScriptContext, {
          type: 'INJECT_TAG',
          payload: { tag: tag, tagId: tagId } as MessagePayloads['INJECT_TAG'],
        });

        setState((prev) => ({
          ...prev,
          injectedTags: [
            {
              id: tagId,
              tag,
              timestamp: Date.now(),
            },
            ...prev.injectedTags,
          ],
        }));
        state.injectedTags.forEach((tag) => {
          logger.info('injected tags:', JSON.stringify(tag));
        });
      },
      [tabId, connectionManager, contentScriptContext]
    ),

    handleTagRemove: useCallback(
      async (tagId: string) => {
        if (!tabId) return;

        connectionManager?.sendMessage(contentScriptContext, {
          type: 'REMOVE_TAG',
          payload: { tagId: tagId } as MessagePayloads['REMOVE_TAG'],
        });

        setState((prev) => ({
          ...prev,
          injectedTags: prev.injectedTags.filter((t) => t.id !== tagId),
        }));
        state.injectedTags.forEach((tag) => {
          logger.info('injected tags:', JSON.stringify(tag));
        });
      },
      [tabId, connectionManager, contentScriptContext]
    ),

    handleToastClose: useCallback(() => {
      setState((prev) => ({ ...prev, toast: null }));
    }, []),

    toggleSettings: useCallback(() => {
      setState((prev) => ({ ...prev, showSettings: !prev.showSettings }));
    }, []),
  };

  const connectionStatus = connectionManager?.getStatus() ?? 'disconnected';

  if (connectionStatus === 'disconnected') {
    return (
      <div className="app-container">
        <div className="app-content">
          <div className="connection-error">Connection lost. Please refresh the page.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="app-content">
        <div className="app-header">
          <button
            onClick={uiHandlers.toggleSelectionMode}
            className={`selection-button ${state.isSelectionMode ? 'enabled' : 'disabled'}`}
            disabled={connectionStatus !== 'connected'}
          >
            <Power size={16} />
            {state.isSelectionMode ? 'Selection Mode On' : 'Selection Mode Off'}
          </button>

          <div className="header-actions">
            <Tooltip content={chrome.i18n.getMessage('tooltipCapture')}>
              <button
                onClick={uiHandlers.handleCapture}
                className="icon-button"
                disabled={connectionStatus !== 'connected'}
              >
                <Camera size={16} />
              </button>
            </Tooltip>
            <Tooltip content={chrome.i18n.getMessage('tooltipSettings')}>
              <button
                onClick={uiHandlers.toggleSettings}
                className={`icon-button ${state.showSettings ? 'active' : ''}`}
                disabled={connectionStatus !== 'connected'}
              >
                <Settings size={16} />
              </button>
            </Tooltip>
          </div>
        </div>

        {state.showSettings ? (
          <SettingsPanel />
        ) : (
          <div className="components-container">
            <DOMSelector
              selectedElement={state.selectedElement}
              onSelectElement={uiHandlers.handleSelectElement}
            />
            {state.showShareCapture && (
              <ShareCapture
                onClose={uiHandlers.handleShareClose}
                selectedElement={state.selectedElement}
                imageDataUrl={state.imageDataUrl}
                captureUrl={state.captureUrl}
                injectedTags={state.injectedTags}
                styleChanges={state.styleChanges}
              />
            )}
            {state.toast && (
              <ToastNotification
                key={state.toast.id}
                message={state.toast.message}
                type={state.toast.type}
                onClose={uiHandlers.handleToastClose}
              />
            )}
            <StyleEditor
              selectedElement={state.selectedElement}
              styleChanges={state.styleChanges}
              onStyleChange={uiHandlers.handleStyleChange}
              onUndoStyleChange={uiHandlers.handleUndoStyleChange}
            />
            <TagInjector
              selectedElement={state.selectedElement}
              injectedTags={state.injectedTags}
              onInjectTag={uiHandlers.handleTagInject}
              onRemoveTag={uiHandlers.handleTagRemove}
            />
          </div>
        )}
        {connectionStatus === 'connecting' && (
          <div className="connection-status">Connecting...</div>
        )}
      </div>
    </div>
  );
}
