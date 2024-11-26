// src/background/background.ts
import { ConnectionManager, Message } from './lib/connectionManager';
import { Logger } from './lib/logger';

const logger = new Logger('Background');

class BackgroundService {
  private static instance: BackgroundService | null = null;
  private manager: ConnectionManager;
  private activeTabId: number | null = null;

  private constructor() {
    this.manager = ConnectionManager.getInstance();
    this.initialize();
  }

  // Singleton instance getter
  public static getInstance(): BackgroundService {
    if (!BackgroundService.instance) {
      BackgroundService.instance = new BackgroundService();
    }
    return BackgroundService.instance;
  }

  // Initialize the background service
  private async initialize(): Promise<void> {
    logger.log('Initializing ...');
    try {
      this.setupInstallListener();
      this.setupMessageSubscription();
      this.setupTabListeners();
      this.setupWindowListeners();
      await this.initializeActiveTab();
      await this.initializeSidePanel();
      logger.log('Initialization complete');
    } catch (error) {
      logger.error('Initialization failed:', error);
    }
  }

  // Extension installed listener
  private setupInstallListener(): void {
    chrome.runtime.onInstalled.addListener(() => {
      logger.log('Extension installed');
    });
    chrome.action.onClicked.addListener((tab) => {
      chrome.sidePanel.open({ windowId: tab.windowId });
    });
  }

  // Message subscription
  private setupMessageSubscription(): void {
    this.manager.setContext('background');
    this.manager.subscribe('CAPTURE_TAB', this.captureTab.bind(this));
  }

  // Capture the visible tab and send the result back to the content script
  private async captureTab(message: Message): Promise<void> {
    logger.log('Received CAPTURE_TAB message');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const windowId = tab.windowId;

      const imageDataUrl = await chrome.tabs.captureVisibleTab(windowId, {
        format: 'png',
        quality: 100,
      });

      logger.log('Tab captured successfully');
      await this.manager.sendMessage(
        'CAPTURE_TAB_RESULT',
        {
          success: true,
          imageDataUrl: imageDataUrl,
          url: tab.url || null,
        },
        message.source
      );
    } catch (error) {
      logger.error('Failed to capture tab:', error);
      await this.manager.sendMessage(
        'CAPTURE_TAB_RESULT',
        {
          success: false,
          error: (error as Error).message,
          url: null,
        },
        message.source
      );
    }
  }

  // Tab activated listener
  private setupTabListeners(): void {
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      logger.debug('Tab activated:', activeInfo.tabId);
      this.activeTabId = activeInfo.tabId;
      await this.handleTabChange(activeInfo.tabId);
    });

    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (tabId === this.activeTabId && changeInfo.status === 'complete') {
        logger.debug('Tab updated:', tabId);
        await this.handleTabChange(tabId);
      }
    });
  }

  // Window event listeners setup
  private setupWindowListeners(): void {
    chrome.windows.onFocusChanged.addListener(async (windowId) => {
      if (windowId !== chrome.windows.WINDOW_ID_NONE) {
        logger.debug('Window focus changed:', windowId);
        const tabs = await chrome.tabs.query({ active: true, windowId });
        if (tabs[0]) {
          this.activeTabId = tabs[0].id ?? null;
          if (this.activeTabId) {
            await this.handleTabChange(this.activeTabId);
          }
        }
      }
    });
  }

  // Initialize the active tab
  private async initializeActiveTab(): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        this.activeTabId = tab.id;
        await this.handleTabChange(tab.id);
      }
    } catch (error) {
      logger.error('Failed to initialize active tab:', error);
    }
  }

  // Active tab change handler
  private async handleTabChange(tabId: number): Promise<void> {
    logger.debug('Handling tab change:', tabId);
    try {
      await this.manager.sendMessage('INITIALIZE_CONTENT', { timestamp: Date.now() });
    } catch (error) {
      logger.error('Failed to send INITIALIZE_CONTENT message:', error);
    }
  }

  // Initialize the side panel
  private async initializeSidePanel(): Promise<void> {
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (error) {
      logger.error('Failed to set panel behavior:', error);
    }
  }
}

// Singleton instance creation
const backgroundService = BackgroundService.getInstance();
