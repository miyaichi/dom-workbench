// src/background.ts
import { ConnectionManager, Message } from './lib/connectionManager';
import { Logger } from './lib/logger';

const logger = new Logger('background');

class BackgroundService {
  private static instance: BackgroundService | null = null;
  private manager: ConnectionManager;

  constructor() {
    this.manager = ConnectionManager.getInstance();

    if (BackgroundService.instance) {
      return BackgroundService.instance;
    }
    BackgroundService.instance = this;

    this.initialize();
  }

  private async initialize() {
    logger.log('Initializing BackgroundService...');
    logger.debug('Setting background context...');
    this.manager.setContext('background');
    logger.debug('Setting up event handlers...');
    await this.setupEventHandlers();
    logger.log('BackgroundService initialization complete');

    await this.setupSidePanel();
  }

  private setupEventHandlers() {
    // Debugging message handler
    this.manager.subscribe('DEBUG', (message: Message) => {
      const timestamp = new Date(message.timestamp).toISOString();
      logger.debug(
        `[${timestamp}] ${message.source} -> ${message.target || 'broadcast'}: ${message.type}`,
        message.payload
      );
    });

    this.manager.subscribe('CAPTURE_TAB', this.captureTab.bind(this));

    chrome.runtime.onInstalled.addListener(() => {
      logger.log('Extension installed/updated');
      this.setupSidePanel();
    });

    chrome.action.onClicked.addListener(this.toggleSidePanel);
    chrome.tabs.onActivated.addListener(this.handleTabActivated.bind(this));
    chrome.tabs.onUpdated.addListener(this.handleTabUpdated.bind(this));
  }

  private async captureTab(message: Message) {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const windowId = tab.windowId;

      const imageDataUrl = await chrome.tabs.captureVisibleTab(windowId, {
        format: 'png',
        quality: 100,
      });

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

  private async handleTabActivated({ tabId, windowId }: chrome.tabs.TabActiveInfo) {
    try {
      const tab = await chrome.tabs.get(tabId);
      logger.debug('Tab info retrieved:', tab);

      if (tab) {
        await this.manager.sendMessage('TAB_ACTIVATED', {
          tabId,
          windowId,
          url: tab.url || '',
          title: tab.title || '',
        });
        logger.debug('TAB_ACTIVATED message sent successfully');
      }
    } catch (error) {
      logger.error('Tab update handling error:', error);
    }
  }

  private async handleTabUpdated(
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab
  ) {
    if (changeInfo.url || changeInfo.status === 'complete') {
      try {
        const updatedTab = await chrome.tabs.get(tabId);

        const updateInfo = {
          tabId,
          windowId: tab.windowId,
          url: updatedTab.url,
          title: updatedTab.title,
          isReload: changeInfo.status === 'complete',
          isUrlChange: Boolean(changeInfo.url),
        };

        logger.log('Tab updated:', updateInfo);
        await this.manager.sendMessage('TAB_UPDATED', updateInfo);
        logger.debug('TAB_UPDATED message sent successfully');
      } catch (error) {
        logger.error('Tab update handling error:', error);
      }
    }
  }

  private async setupSidePanel() {
    try {
      await chrome.sidePanel.setOptions({
        enabled: true,
        path: 'sidepanel.html',
      });
      logger.log('Side panel settings updated');
    } catch (error) {
      logger.error('Failed to setup side panel:', error);
    }
  }

  private toggleSidePanel = (tab: chrome.tabs.Tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        logger.error('Failed to open side panel:', error);
      } else {
        logger.log('Side panel opened successfully');
      }
    });
  };
}

new BackgroundService();
