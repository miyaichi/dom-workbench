import { ConnectionManager } from '../lib/connectionManager';
import { Logger } from '../lib/logger';
import { BaseMessage, ExtensionMessage, MessagePayloads, TabInfo } from '../types/messages';
import { Context } from '../types/types';

class BackgroundService {
  private connectionManager: ConnectionManager;
  private logger: Logger;
  private activeTabInfo: TabInfo | null = null;
  private contentScriptContext: Context = 'undefined';
  private readonly ports = new Map<string, chrome.runtime.Port>();
  private readonly RESTRICTED_PATTERNS = [
    'chrome://',
    'chrome-extension://',
    'devtools://',
    'edge://',
    'about:',
  ];

  constructor() {
    this.logger = new Logger('background');
    this.connectionManager = new ConnectionManager('background');
    this.setupConnection();
    this.setupChromeListeners();
    this.setupSidepanel();
  }

  private isScriptInjectionAllowed(url: string): boolean {
    if (!url) return false;
    return !this.RESTRICTED_PATTERNS.some((pattern) => url.startsWith(pattern));
  }

  private async setupConnection() {
    try {
      this.connectionManager.connect();
    } catch (error: any) {
      this.logger.error('Failed to setup connection:', error);
    }
  }

  private setupChromeListeners() {
    // Monitor tab activation
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        await this.handleTabActivation(tab);
      } catch (error) {
        this.logger.error('Failed to handle tab activation:', error);
      }
    });

    // Monitor tab URL change
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      try {
        if (changeInfo.status === 'complete' && tab.active) {
          await this.handleTabActivation(tab);
        }
      } catch (error) {
        this.logger.error('Failed to handle tab update:', error);
      }
    });

    // Monitor window focus
    chrome.windows.onFocusChanged.addListener(async (windowId) => {
      try {
        if (windowId === chrome.windows.WINDOW_ID_NONE) return;

        const [tab] = await chrome.tabs.query({ active: true, windowId });
        if (tab) {
          await this.handleTabActivation(tab);
        }
      } catch (error) {
        this.logger.error('Failed to handle window focus change:', error);
      }
    });

    // Monitor connections
    chrome.runtime.onConnect.addListener((port) => {
      this.logger.debug('Port connected:', port.name);
      this.ports.set(port.name, port);

      port.onMessage.addListener((message: ExtensionMessage) => {
        if (message.target === 'background') {
          // Handle messages targeted to background
          this.handleMessage(port, message);
          return;
        }

        const targetPort = this.ports.get(message.target);
        if (targetPort) {
          // Forward messages between content script and side panel
          this.logger.debug('Forwarding message:', message);
          targetPort?.postMessage(message);
        }
      });

      port.onDisconnect.addListener(this.handlePortDisconnection);
    });
  }

  private handlePortDisconnection = async (port: chrome.runtime.Port) => {
    this.logger.debug('Port disconnected:', port.name);

    // Check for BFCache error
    const error = chrome.runtime.lastError;
    if (error?.message?.includes('back/forward cache')) {
      this.logger.info('Port disconnected due to BFCache:', port.name);
    }

    // Handle sidepanel specific disconnect
    if (port.name === 'sidepanel') {
      try {
        if (this.activeTabInfo?.tabId && this.activeTabInfo.isScriptInjectionAllowed) {
          await chrome.tabs.sendMessage(this.activeTabInfo.tabId, { type: 'SIDEPANEL_CLOSED' });
        }
      } catch (error) {
        this.logger.info('Failed to notify content script:', error);
      }
    }

    // Cleanup port
    this.ports.delete(port.name);
  };

  private async handleTabActivation(tab: chrome.tabs.Tab) {
    if (!tab.id || !tab.url) return;

    const isAllowed = this.isScriptInjectionAllowed(tab.url);
    this.activeTabInfo = {
      windowId: tab.windowId,
      tabId: tab.id,
      url: tab.url,
      isScriptInjectionAllowed: isAllowed,
    } as TabInfo;

    // Store the active tab info
    await chrome.storage.local.set({ activeTabInfo: this.activeTabInfo });

    if (!isAllowed) {
      this.logger.info('Script injection not allowed for this URL:', tab.url);
      this.contentScriptContext = 'undefined';
      return;
    }

    try {
      // Check if content script is already injected
      await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
    } catch (error: any) {
      // Inject only if allowed and not already injected
      if (error.toString().includes('Could not establish connection')) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['contentScript.js'],
        });
      }
    }

    // Set the context for the content script in the active tab
    this.contentScriptContext = `content-${tab.id}`;
  }

  private async setupSidepanel(): Promise<void> {
    try {
      // Open the side panel on action clicks
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (error) {
      this.logger.error('Failed to set panel behavior:', error);
    }
  }

  /**
   * Helper function to send messages from background to other components.
   * Uses direct port.postMessage for reliable message delivery.
   */
  private sendMessage<T extends BaseMessage>(
    target: Context,
    port: chrome.runtime.Port,
    messageData: Omit<T, 'source' | 'target' | 'timestamp'>
  ): void {
    const message = {
      ...messageData,
      source: 'background',
      target,
      timestamp: Date.now(),
    } as T;

    port.postMessage(message);
    this.logger.debug('Message sent', { target, type: message.type });
  }

  private handleMessage = (port: chrome.runtime.Port, message: ExtensionMessage) => {
    this.logger.debug('Message received', { type: message.type });
    // Implement message handling if needed
    //
    // When replying to a message, use this.sendMessage instead of ConnectionManager.sendMessage
    // to keep the flow of messages consistent and avoid port disconnection issues.
    switch (message.type) {
      case 'CAPTURE_TAB': {
        this.handleCaptureTab(port, message.source);
        break;
      }
      case 'EXECUTE_SCRIPT': {
        const payload = message.payload as MessagePayloads['EXECUTE_SCRIPT'];
        this.handleExecuteScript(port, payload);
        break;
      }
    }
  };

  // Capture the active tab and send the image data to the sidepanel
  private async handleCaptureTab(port: chrome.runtime.Port, source: Context): Promise<void> {
    this.logger.info('Received CAPTURE_TAB message');
    try {
      if (!this.activeTabInfo) {
        throw new Error('No active tab found');
      }

      const windowId = this.activeTabInfo.windowId;
      const imageDataUrl = await chrome.tabs.captureVisibleTab(windowId, {
        format: 'png',
        quality: 100,
      });

      this.logger.info('Tab captured successfully');
      this.sendMessage(source, port, {
        type: 'CAPTURE_TAB_RESULT',
        payload: { success: true, imageDataUrl, url: this.activeTabInfo.url ?? null },
      });
    } catch (error) {
      this.logger.info('Failed to capture tab:', error);
      this.sendMessage(source, port, {
        type: 'CAPTURE_TAB_RESULT',
        payload: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          imageDataUrl: undefined,
          url: null,
        },
      });
    }
  }

  // Execute the provided script in the active tab
  private async handleExecuteScript(
    port: chrome.runtime.Port,
    params: { script: string } | { url: string }
  ): Promise<void> {
    const tabId = this.activeTabInfo?.tabId;
    if (!tabId) return;

    if (('script' in params && 'url' in params) || (!('script' in params) && !('url' in params)))
      return;
    try {
      const script =
        'script' in params ? params.script : await this.fetchExternalScript(params.url);
      if (!script) {
        throw new Error('Script content is empty');
      }

      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN', // Use the main world for script execution
        args: [script],
        func: (scriptContent: string) => {
          try {
            const result = new Function(scriptContent)();
            return { success: true, result };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Script execution failed',
            };
          }
        },
      });

      this.logger.info('Script executed successfully');
      this.sendMessage(this.contentScriptContext, port, {
        type: 'EXECUTE_SCRIPT_RESULT',
        payload: { success: true },
      });
    } catch (error) {
      this.logger.error('Failed to execute script:', error);
      this.sendMessage(this.contentScriptContext, port, {
        type: 'EXECUTE_SCRIPT_RESULT',
        payload: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  private async fetchExternalScript(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      fetch(url)
        .then((response) => response.text())
        .then(resolve)
        .catch(reject);
    });
  }
}

// Initialize the background service
new BackgroundService();
