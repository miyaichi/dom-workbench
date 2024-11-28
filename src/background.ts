import { ConnectionManager } from './lib/connectionManager';
import { Logger } from './lib/logger';
import { Context } from './types/messages';
import { getContentScriptContext } from './utils/contextHelpers';

const logger = new Logger('Background');

class BackgroundService {
  private static instance: BackgroundService | null = null;
  private manager: ConnectionManager;
  private context: Context = 'background';
  private activeTabId: number | null = null;

  private constructor() {
    this.manager = ConnectionManager.getInstance();
    this.initialize();
  }

  public static getInstance(): BackgroundService {
    if (!BackgroundService.instance) {
      BackgroundService.instance = new BackgroundService();
    }
    return BackgroundService.instance;
  }

  private async initialize(): Promise<void> {
    logger.log('Initializing ...');
    try {
      this.setupInstallListener();
      this.setupTagIdListener();
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

  private setupInstallListener(): void {
    chrome.runtime.onInstalled.addListener(() => {
      logger.log('Extension installed');
    });
    chrome.action.onClicked.addListener((tab) => {
      chrome.sidePanel.open({ windowId: tab.windowId });
    });
  }

  private setupTagIdListener(): void {
    // This listener is used for the contentScript to obtain its Tab ID
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'GET_TAB_ID' && sender.tab?.id) {
        sendResponse({ tabId: sender.tab.id });
      }
    });
  }

  private setupMessageSubscription(): void {
    this.manager.setContext(this.context);
    this.manager.subscribe('CAPTURE_TAB', this.captureTab.bind(this));
  }

  private async captureTab(): Promise<void> {
    logger.log('Received CAPTURE_TAB message');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error('No active tab found');
      }

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
          imageDataUrl,
          url: tab.url ?? null,
        },
        'sidepanel'
      );
    } catch (error) {
      logger.error('Failed to capture tab:', error);
      await this.manager.sendMessage(
        'CAPTURE_TAB_RESULT',
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          imageDataUrl: undefined,
          url: null,
        },
        'sidepanel'
      );
    }
  }

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

  private async handleTabChange(tabId: number): Promise<void> {
    logger.debug('Handling tab change:', tabId);
    try {
      const contentScriptContext = getContentScriptContext(tabId);

      // Change the context and clear the old message queue
      this.manager.setContext(this.context);

      // Send messages to the specific content script
      await this.manager.sendMessage('TAB_ACTIVATED', { tabId }, 'sidepanel');
      await this.manager.sendMessage('GET_CONTENT_STATE', undefined, contentScriptContext);
    } catch (error) {
      logger.error('Failed to send GET_CONTENT_STATE message:', error);
    }
  }

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
