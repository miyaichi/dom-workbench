import { Camera, Power, Settings } from 'lucide-react';
import { nanoid } from 'nanoid';
import React, { useCallback, useEffect, useState } from 'react';
import { DOMSelector } from '../components/DOMSelector';
import { SettingsPanel } from '../components/SettingsPanel';
import { ShareCapture } from '../components/ShareCapture';
import { StyleEditor } from '../components/StyleEditor';
import { TagInjector } from '../components/TagInjector';
import { ToastNotification } from '../components/common/ToastNotification';
import { Tooltip } from '../components/common/Tooltip';
import { ConnectionManager, useConnectionManager } from '../lib/connectionManager';
import { Logger } from '../lib/logger';
import { ElementInfo } from '../types/domSelection';
import { getContentScriptContext } from '../utils/contextHelpers';

const logger = new Logger('SidePanel');

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

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
  currentTabId: number | null;
  isSelectionMode: boolean;
  showSettings: boolean;
  showShareCapture: boolean;
  selectedElement: ElementInfo | null;
  imageDataUrl: string | null;
  captureUrl: string | null;
  toast: Toast | null;
  injectedTags: InjectedTagInfo[];
  styleChanges: StyleChange[];
  connectionStatus: ConnectionStatus;
}

export const App = () => {
  const [state, setState] = useState<AppState>({
    currentTabId: null,
    isSelectionMode: false,
    showSettings: false,
    showShareCapture: false,
    selectedElement: null,
    imageDataUrl: null,
    captureUrl: null,
    toast: null,
    injectedTags: [],
    styleChanges: [],
    connectionStatus: 'connected',
  });
  const manager = ConnectionManager.getInstance();
  const { sendMessage, subscribe } = useConnectionManager();
  const initialized = React.useRef(false);

  // Initialize tab monitoring
  useEffect(() => {
    let isSubscribed = true;

    const initializeTab = async () => {
      if (initialized.current) {
        logger.debug('App already initialized, skipping...');
        return;
      }

      try {
        manager.setContext('sidepanel');

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id && isSubscribed) {
          setState((prev) => {
            // If the tab ID is the same, do not update
            if (prev.currentTabId === tab.id) return prev;
            return { ...prev, currentTabId: tab.id ?? null };
          });

          const contentScriptContext = getContentScriptContext(tab.id);
          await sendMessage('GET_CONTENT_STATE', undefined, contentScriptContext);
          initialized.current = true;
        }
      } catch (error) {
        logger.error('Tab initialization failed:', error);
      }
    };

    initializeTab();

    // Tab change handler
    const handleTabChange = (activeInfo?: chrome.tabs.TabActiveInfo) => {
      if (activeInfo?.tabId) {
        setState((prev) => ({ ...prev, currentTabId: activeInfo.tabId ?? null }));
      }
    };

    chrome.tabs.onActivated.addListener(handleTabChange);

    return () => {
      isSubscribed = false;
      chrome.tabs.onActivated.removeListener(handleTabChange);
      logger.debug('Tab monitoring cleanup');
    };
  }, []);

  // Message handlers
  const messageHandlers = {
    handleTabActivated: useCallback(
      async (message: { payload: { tabId: number } }) => {
        try {
          const { tabId } = message.payload;
          logger.debug('Tab activated with ID:', tabId);
          setState((prev) => ({ ...prev, currentTabId: tabId }));

          const contentScriptContext = getContentScriptContext(tabId);
          await sendMessage('GET_CONTENT_STATE', undefined, contentScriptContext);
        } catch (error) {
          logger.error('Failed to handle tab activation:', error);
        }
      },
      [sendMessage]
    ),

    handleContentStateUpdate: useCallback((message: any) => {
      const { isSelectionMode, selectedElementInfo } = message.payload;
      setState((prev) => ({
        ...prev,
        isSelectionMode,
        selectedElement: selectedElementInfo,
      }));
    }, []),

    handleElementSelected: useCallback((message: { payload: { elementInfo: ElementInfo } }) => {
      logger.log('Element selected:', message.payload.elementInfo);
      setState((prev) => ({ ...prev, selectedElement: message.payload.elementInfo }));
    }, []),

    handleElementUnselected: useCallback(() => {
      logger.log('Element unselected');
      setState((prev) => ({ ...prev, selectedElement: null }));
    }, []),

    handleCaptureResult: useCallback((message: any) => {
      const { success, imageDataUrl, error, url } = message.payload;
      if (success) {
        setState((prev) => ({
          ...prev,
          imageDataUrl: imageDataUrl || null,
          captureUrl: url || '',
        }));
      } else {
        logger.error('Capture failed:', error);
      }
    }, []),

    handleShowToast: useCallback((message: { payload: { message: string; type?: string } }) => {
      setState((prev) => ({
        ...prev,
        toast: {
          id: Date.now().toString(),
          message: message.payload.message,
          type: message.payload.type as 'success' | 'error' | undefined,
        },
      }));
    }, []),
  };

  // Message subscriptions
  useEffect(() => {
    if (!initialized.current) {
      logger.debug('Waiting for initialization...');
      return;
    }

    let isSubscribed = true;
    const subscriptions = new Map();

    const subscriptionConfigs = {
      CAPTURE_TAB_RESULT: messageHandlers.handleCaptureResult,
      CONTENT_STATE_UPDATE: messageHandlers.handleContentStateUpdate,
      ELEMENT_SELECTED: messageHandlers.handleElementSelected,
      ELEMENT_UNSELECTED: messageHandlers.handleElementUnselected,
      SHOW_TOAST: messageHandlers.handleShowToast,
      TAB_ACTIVATED: messageHandlers.handleTabActivated,
    };

    logger.debug('Setting up message subscriptions');
    Object.entries(subscriptionConfigs).forEach(([event, handler]) => {
      subscriptions.set(
        event,
        subscribe(event as any, (msg: any) => {
          if (isSubscribed) handler(msg);
        })
      );
    });

    return () => {
      logger.debug('Cleaning up message subscriptions');
      isSubscribed = false;
      subscriptions.forEach((unsubscribe) => unsubscribe());
      subscriptions.clear();
    };
  }, [messageHandlers, subscribe, initialized.current]);

  // Monitor document visibility
  useEffect(() => {
    let isSubscribed = true;

    const handleVisibilityChange = async () => {
      if (!isSubscribed || !document.hidden) return;

      logger.log('Document hidden, cleaning up');
      setState((prev) => ({
        ...prev,
        showSettings: false,
        showShareCapture: false,
      }));

      if (state.currentTabId && state.isSelectionMode) {
        try {
          const contentScriptContext = getContentScriptContext(state.currentTabId);
          await sendMessage('TOGGLE_SELECTION_MODE', { enabled: false }, contentScriptContext);
          setState((prev) => ({ ...prev, isSelectionMode: false }));
        } catch (error) {
          logger.error('Failed to disable selection mode:', error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      isSubscribed = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.currentTabId, state.isSelectionMode, sendMessage]);

  // UI handlers
  const uiHandlers = {
    handleCapture: useCallback(() => {
      if (!state.currentTabId) return;
      setState((prev) => ({ ...prev, showShareCapture: true }));
      sendMessage('CAPTURE_TAB', undefined, 'background');
    }, [state.currentTabId, sendMessage]),

    handleShareClose: useCallback(() => {
      setState((prev) => ({ ...prev, showShareCapture: false }));
    }, []),

    handleSelectElement: useCallback(
      (path: number[]) => {
        if (!state.currentTabId) return;
        const contentScriptContext = getContentScriptContext(state.currentTabId);
        sendMessage('SELECT_ELEMENT', { path }, contentScriptContext);
      },
      [state.currentTabId, sendMessage]
    ),

    toggleSelectionMode: useCallback(async () => {
      if (!state.currentTabId) return;
      const enabled = !state.isSelectionMode;
      setState((prev) => ({ ...prev, isSelectionMode: enabled }));
      const contentScriptContext = getContentScriptContext(state.currentTabId);
      await sendMessage('TOGGLE_SELECTION_MODE', { enabled }, contentScriptContext);
    }, [state.currentTabId, state.isSelectionMode, sendMessage]),

    handleStyleChange: useCallback(
      (property: string, value: string, oldValue: string) => {
        if (!state.currentTabId || !state.selectedElement) return;

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

        const contentScriptContext = getContentScriptContext(state.currentTabId);
        sendMessage('UPDATE_ELEMENT_STYLE', { property, value }, contentScriptContext);
      },
      [state.currentTabId, state.selectedElement, sendMessage]
    ),

    handleUndoStyleChange: useCallback(() => {
      if (!state.currentTabId || state.styleChanges.length === 0) return;

      const latestChange = state.styleChanges[0];
      const contentScriptContext = getContentScriptContext(state.currentTabId);
      sendMessage(
        'UPDATE_ELEMENT_STYLE',
        { property: latestChange.property as string, value: latestChange.oldValue },
        contentScriptContext
      );

      setState((prev) => ({
        ...prev,
        styleChanges: prev.styleChanges.slice(1),
      }));
    }, [state.currentTabId, state.styleChanges, sendMessage]),

    handleTagInject: useCallback(
      async (tag: string, tagId: string) => {
        if (!state.currentTabId) return;
        const contentScriptContext = getContentScriptContext(state.currentTabId);
        await sendMessage('INJECT_TAG', { tag, tagId }, contentScriptContext);
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
          logger.log('injected tags:', JSON.stringify(tag));
        });
      },
      [state.currentTabId, sendMessage]
    ),

    handleTagRemove: useCallback(
      async (tagId: string) => {
        if (!state.currentTabId) return;
        const contentScriptContext = getContentScriptContext(state.currentTabId);
        await sendMessage('REMOVE_TAG', { tagId }, contentScriptContext);
        setState((prev) => ({
          ...prev,
          injectedTags: prev.injectedTags.filter((t) => t.id !== tagId),
        }));
        state.injectedTags.forEach((tag) => {
          logger.log('injected tags:', JSON.stringify(tag));
        });
      },
      [state.currentTabId, sendMessage]
    ),

    handleToastClose: useCallback(() => {
      setState((prev) => ({ ...prev, toast: null }));
    }, []),

    toggleSettings: useCallback(() => {
      setState((prev) => ({ ...prev, showSettings: !prev.showSettings }));
    }, []),
  };

  if (state.connectionStatus === 'disconnected') {
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
            disabled={state.connectionStatus !== 'connected'}
          >
            <Power size={16} />
            {state.isSelectionMode ? 'Selection Mode On' : 'Selection Mode Off'}
          </button>

          <div className="header-actions">
            <Tooltip content={chrome.i18n.getMessage('tooltipCapture')}>
              <button
                onClick={uiHandlers.handleCapture}
                className="icon-button"
                disabled={state.connectionStatus !== 'connected'}
              >
                <Camera size={16} />
              </button>
            </Tooltip>
            <Tooltip content={chrome.i18n.getMessage('tooltipSettings')}>
              <button
                onClick={uiHandlers.toggleSettings}
                className={`icon-button ${state.showSettings ? 'active' : ''}`}
                disabled={state.connectionStatus !== 'connected'}
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
        {state.connectionStatus === 'reconnecting' && (
          <div className="connection-status">Reconnecting...</div>
        )}
      </div>
    </div>
  );
};
