import { ConnectionManager } from '../lib/connectionManager';
import { Logger } from '../lib/logger';
import { MessageHandler, MessagePayloads } from '../types/messages';
import { ElementInfo } from '../types/types';
import { createElementInfo, getElementByPath } from '../utils/domSelection';
import { htmlToDoc } from '../utils/htmlToDoc';

class ContentScript {
  private connectionManager: ConnectionManager | null = null;
  private logger: Logger;
  private state = {
    isSelectionMode: false,
    selectedElementInfo: null as ElementInfo | null,
    hoveredElement: null as HTMLElement | null,
  };

  constructor() {
    this.logger = new Logger('content-script');
    this.initialize();

    this.injectStyles();
    this.setupEventListeners();
  }

  private async initialize() {
    try {
      // Listen for PING messages
      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'PING') return true;
        if (message.type === 'SIDEPANEL_CLOSED') {
          this.performCleanup();
          return true;
        }
      });

      // Get activeTabInfo from storage
      const { activeTabInfo } = await chrome.storage.local.get('activeTabInfo');

      if (activeTabInfo?.isScriptInjectionAllowed) {
        this.setupConnection(activeTabInfo.tabId);
      } else {
        this.logger.debug('Script injection not allowed for this tab');
      }

      // Listen for storage changes
      chrome.storage.local.onChanged.addListener((changes) => {
        const { oldValue, newValue } = changes.activeTabInfo || {};
        const newTabId = newValue?.tabId;
        const isAllowed = newValue?.isScriptInjectionAllowed;

        // Setup connection if allowed and connection doesn't exist or tabId has changed
        if (newTabId && isAllowed && (!this.connectionManager || newTabId !== oldValue?.tabId)) {
          this.setupConnection(newTabId);
        }
      });
    } catch (error) {
      this.logger.error('Failed to initialize content script:', error);
    }
  }

  private setupConnection(tabId: number) {
    if (this.connectionManager) {
      this.logger.debug('Connection already established');
      return;
    }

    try {
      this.connectionManager = new ConnectionManager(`content-${tabId}`, this.handleMessage);
      this.connectionManager.connect();
      this.logger.info('Connection established. tabId:', tabId);
    } catch (error) {
      this.logger.error('Failed to setup connection:', error);
    }
  }

  private handleMessage: MessageHandler = (message) => {
    this.logger.debug('Message received', { type: message.type });

    switch (message.type) {
      case 'GET_CONTENT_STATE':
        this.handleGetCurrentState();
        break;
      case 'INJECT_TAG':
        const injectTagPayload = message.payload as MessagePayloads['INJECT_TAG'];
        this.handleTagInjection(injectTagPayload.tag, injectTagPayload.tagId);
        break;
      case 'REMOVE_TAG':
        const removeTagPayload = message.payload as MessagePayloads['REMOVE_TAG'];
        this.handleTagRemoval(removeTagPayload.tagId);
        break;
      case 'SELECT_ELEMENT':
        const selectElementPayload = message.payload as MessagePayloads['SELECT_ELEMENT'];
        this.handleSelectedElement(selectElementPayload.path);
        break;
      case 'TOGGLE_SELECTION_MODE':
        const toggleSelectionModePayload =
          message.payload as MessagePayloads['TOGGLE_SELECTION_MODE'];
        this.handleToggleSelectionMode(toggleSelectionModePayload.enabled);
        break;
      case 'UPDATE_ELEMENT_STYLE':
        const updateElementStylePayload =
          message.payload as MessagePayloads['UPDATE_ELEMENT_STYLE'];
        this.handleUpdateElementStyle(
          updateElementStylePayload.property,
          updateElementStylePayload.value
        );
        break;
    }
  };

  // Cleanup on sidepanel close
  private performCleanup() {
    this.logger.info('Sidepanel closed, performing cleanup');
    this.state.isSelectionMode = false;
    this.clearSelection();
  }

  // Inject styles
  private injectStyles() {
    const styleId = 'extension-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = this.getInjectedStyles();
      document.head.appendChild(style);
      this.logger.debug('Styles injected successfully');
    }
  }

  private getInjectedStyles(): string {
    return `
      .extension-selection-mode,
      .extension-selection-mode * {
        cursor: crosshair !important;
        user-select: none !important;
      }
      
      .extension-highlight {
        outline: 2px solid #ffd700 !important;
        outline-offset: 2px;
        background-color: rgba(255, 215, 0, 0.1) !important;
        transition: all 0.2s ease;
        pointer-events: auto !important;
      }

      .extension-selected {
        outline: 2px solid #4682B4 !important;
        outline-offset: 2px;
        background-color: rgba(70, 130, 180, 0.1) !important;
        transition: all 0.2s ease;
      }

      html.extension-selection-mode,
      html.extension-selection-mode body,
      html.extension-selection-mode * {
        cursor: crosshair !important;
      }
    `;
  }

  // Event listeners
  private setupEventListeners() {
    const handleMouseOver = (e: MouseEvent) => this.handleMouseOver(e);
    const handleMouseOut = (e: MouseEvent) => this.handleMouseOut(e);
    const handleClick = (e: MouseEvent) => this.handleClick(e);

    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
      document.removeEventListener('click', handleClick, true);
    };
  }

  private handleMouseOver(event: MouseEvent) {
    if (!this.state.isSelectionMode) return;

    const target = event.target as HTMLElement;
    if (!target || target === document.body || target === document.documentElement) return;

    if (this.state.hoveredElement && this.state.hoveredElement !== target) {
      this.state.hoveredElement.classList.remove('extension-highlight');
    }

    this.state.hoveredElement = target;
    target.classList.add('extension-highlight');
  }

  private handleMouseOut(event: MouseEvent) {
    if (!this.state.isSelectionMode || !this.state.hoveredElement) return;

    const target = event.target as HTMLElement;
    if (target === this.state.hoveredElement) {
      target.classList.remove('extension-highlight');
      this.state.hoveredElement = null;
    }
  }

  private handleClick(event: MouseEvent) {
    if (!this.state.isSelectionMode) return;

    event.preventDefault();
    event.stopPropagation();

    const target = event.target as HTMLElement;
    if (!target || target === document.body || target === document.documentElement) return;

    this.elementSelection(target);
  }

  // Send current state to sidepanel
  private async handleGetCurrentState() {
    this.logger.info('Sending current state', this.state);
    this.connectionManager?.sendMessage('sidepanel', {
      type: 'CONTENT_STATE_UPDATE',
      payload: {
        isSelectionMode: this.state.isSelectionMode,
        selectedElementInfo: this.state.selectedElementInfo,
      },
    });
  }

  // Inject and remove tags
  private async handleTagInjection(tag: string, tagId: string) {
    if (!this.state.selectedElementInfo) {
      return;
    }

    try {
      const targetElement = getElementByPath(this.state.selectedElementInfo.path);
      if (!targetElement) {
        throw new Error('Target element not found');
      }

      const TAG_ID_ATTRIBUTE = 'data-injected-tag-id';

      const domElement = await htmlToDoc(tag, {
        async: true,
        preserveOrder: true,
        onScriptsLoaded: () => {
          this.logger.debug(`Scripts loaded for tag ${tagId}`);
          this.connectionManager?.sendMessage('sidepanel', {
            type: 'SHOW_TOAST',
            payload: { message: chrome.i18n.getMessage('toastTagLoaded'), type: 'success' },
          });
        },
      });

      // Set tag ID to the root element of the injected tag
      if (domElement instanceof DocumentFragment) {
        Array.from(domElement.children).forEach((child) => {
          child.setAttribute(TAG_ID_ATTRIBUTE, tagId);
        });
      } else if (domElement instanceof Element) {
        domElement.setAttribute(TAG_ID_ATTRIBUTE, tagId);
      }

      targetElement.appendChild(domElement);

      this.logger.info('Tag injected successfully:', {
        tagId,
        targetPath: this.state.selectedElementInfo.path,
      });

      this.connectionManager?.sendMessage('sidepanel', {
        type: 'SHOW_TOAST',
        payload: { message: chrome.i18n.getMessage('toastTagInjected'), type: 'success' },
      });
    } catch (error) {
      this.logger.error('Tag injection failed:', error);
      this.connectionManager?.sendMessage('sidepanel', {
        type: 'SHOW_TOAST',
        payload: { message: chrome.i18n.getMessage('toastTagInjected'), type: 'error' },
      });
    }
  }

  private handleTagRemoval(tagId: string) {
    try {
      const TAG_ID_ATTRIBUTE = 'data-injected-tag-id';
      const injectedElements = document.querySelectorAll(`[${TAG_ID_ATTRIBUTE}="${tagId}"]`);

      if (injectedElements.length === 0) {
        throw new Error(`No elements found with tag ID: ${tagId}`);
      }

      injectedElements.forEach((element) => {
        element.remove();
      });

      this.logger.info('Tag removed successfully:', { tagId });

      this.connectionManager?.sendMessage('sidepanel', {
        type: 'SHOW_TOAST',
        payload: { message: chrome.i18n.getMessage('toastTagRemoved'), type: 'success' },
      });
    } catch (error) {
      this.logger.error('Tag removal failed:', error);
      this.connectionManager?.sendMessage('sidepanel', {
        type: 'SHOW_TOAST',
        payload: { message: chrome.i18n.getMessage('toastTagRemoveFailed'), type: 'error' },
      });
    }
  }

  // Element selection
  private handleSelectedElement(path: number[]) {
    const element = getElementByPath(path);
    if (element) {
      this.elementSelection(element);
    }
  }

  private elementSelection(element: HTMLElement) {
    // Clear previously selected elements
    const selectedElements = document.querySelectorAll('.extension-selected');
    selectedElements.forEach((el) => {
      el.classList.remove('extension-selected');
    });

    // Clear hover, set selected element, set selected
    element.classList.remove('extension-highlight');
    this.state.selectedElementInfo = createElementInfo(element);
    element.classList.add('extension-selected');

    this.logger.debug('Element selected:', this.state.selectedElementInfo);
    this.connectionManager?.sendMessage('sidepanel', {
      type: 'ELEMENT_SELECTED',
      payload: { elementInfo: this.state.selectedElementInfo },
    });
  }

  private clearSelection() {
    // Clear hovered element
    if (this.state.hoveredElement) {
      this.state.hoveredElement.classList.remove('extension-highlight');
      this.state.hoveredElement = null;
    }

    // Clear selected elements
    const selectedElements = document.querySelectorAll('.extension-selected');
    selectedElements.forEach((element) => {
      element.classList.remove('extension-selected');
    });

    // Clear selected element info
    if (this.state.selectedElementInfo) {
      this.logger.debug('Element unselected:', this.state.selectedElementInfo);
      this.connectionManager?.sendMessage('sidepanel', {
        type: 'ELEMENT_UNSELECTED',
        payload: { elementInfo: this.state.selectedElementInfo },
      });
      this.state.selectedElementInfo = null;
    }
  }

  // Toggles selection mode
  private handleToggleSelectionMode(enabled: boolean) {
    if (this.state.isSelectionMode === enabled) return;

    this.state.isSelectionMode = enabled;
    if (!enabled) {
      this.clearSelection();
    }

    document.documentElement.classList.toggle('extension-selection-mode', enabled);
    document.body.classList.toggle('extension-selection-mode', enabled);

    this.logger.debug('Selection mode toggled:', {
      enabled: this.state.isSelectionMode,
      hasSelectionModeClass: document.documentElement.classList.contains(
        'extension-selection-mode'
      ),
    });
  }

  // Update element style
  private handleUpdateElementStyle(property: string, value: string) {
    if (!this.state.selectedElementInfo) {
      this.logger.error('No element selected for style update');
      return;
    }

    try {
      const targetElement = getElementByPath(this.state.selectedElementInfo.path);
      if (!targetElement) {
        throw new Error('Target element not found');
      }

      const STYLE_MODIFIED_ATTRIBUTE = 'data-extension-modified-styles';

      let modifiedStyles: { [key: string]: string } = {};
      const existingStyles = targetElement.getAttribute(STYLE_MODIFIED_ATTRIBUTE);
      if (existingStyles) {
        modifiedStyles = JSON.parse(existingStyles);
      }

      // Update element style
      targetElement.style[property as any] = value;

      // Update modified styles
      modifiedStyles[property] = value;
      targetElement.setAttribute(STYLE_MODIFIED_ATTRIBUTE, JSON.stringify(modifiedStyles));

      this.logger.info('Element style updated:', {
        property,
        value,
        path: this.state.selectedElementInfo.path,
      });

      this.connectionManager?.sendMessage('sidepanel', {
        type: 'SHOW_TOAST',
        payload: { message: chrome.i18n.getMessage('toastStyleUpdated'), type: 'error' },
      });
    } catch (error) {
      this.logger.error('Element style update failed:', error);
      this.connectionManager?.sendMessage('sidepanel', {
        type: 'SHOW_TOAST',
        payload: { message: chrome.i18n.getMessage('toastStyleUpdateFailed'), type: 'error' },
      });
    }
  }
}

// Initialize content script
if (!window.contentScriptInitialized) {
  window.contentScriptInitialized = true;
  new ContentScript();
}
