import { ConnectionManager } from '../lib/connectionManager';
import { Logger } from '../lib/logger';
import { MessageHandler, MessagePayloads } from '../types/messages';
import { ElementInfo } from '../types/types';
import { createElementInfo, getElementByPath } from '../utils/domSelection';

// Classes and attributes used by the extension
const EXTENSION_HIGHLIGHT_CLASS = 'extension-highlight';
const EXTENSION_SELECTED_CLASS = 'extension-selected';
const EXTENSION_SELECTION_MODE_CLASS = 'extension-selection-mode';
const EXTENSION_STYLE_MODIFIED_ATTRIBUTE = 'data-extension-modified-styles';
const EXTENSION_TAG_ID_ATTRIBUTE = 'data-extension-tag-id';

class ContentScript {
  private connectionManager: ConnectionManager | null = null;
  private logger: Logger;
  private state = {
    isSelectionMode: false,
    selectedElementInfo: null as ElementInfo | null,
    hoveredElement: null as HTMLElement | null,
  };
  private executeScriptPromise: {
    resolve: (success: boolean) => void;
    reject: (error: string) => void;
  } | null = null;

  constructor() {
    this.logger = new Logger('content-script');
    this.initialize();

    this.injectStyles();
    this.setupEventListeners();
  }

  private async initialize() {
    try {
      // Listen for PING and SIDEPANEL_CLOSED messages
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'PING') {
          sendResponse({ status: 'alive' });
          return false;
        }
        if (message.type === 'SIDEPANEL_CLOSED') {
          this.logger.info('Sidepanel closed, performing cleanup');
          this.performCleanup();
          sendResponse({ status: 'cleaned' });
          return false;
        }
      });

      // Listen for page show events
      window.addEventListener('pageshow', async (event) => {
        const e = event as PageTransitionEvent;
        if (e.persisted) {
          this.logger.info('Page restored from BFCache');

          // Reset connection and cleanup
          this.connectionManager = null;
          this.performCleanup();
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

      // Monitor connection status, perform cleanup on disconnect
      const intervalId = setInterval(() => {
        const connectionStatus = this.connectionManager?.getStatus() || 'disconnected';
        if (connectionStatus !== 'connected') {
          this.logger.info('Connection lost, performing cleanup');
          this.performCleanup();
          clearInterval(intervalId);
        }
      }, 5000);
    } catch (error) {
      this.logger.error('Failed to setup connection:', error);
    }
  }

  private handleMessage: MessageHandler = (message) => {
    this.logger.debug('Message received', { type: message.type });

    switch (message.type) {
      case 'EXECUTE_SCRIPT_RESULT': {
        const payload = message.payload as MessagePayloads['EXECUTE_SCRIPT_RESULT'];
        this.handleExecutionScriptResult(payload.success, payload.error);
        break;
      }
      case 'INJECT_TAG': {
        const payload = message.payload as MessagePayloads['INJECT_TAG'];
        this.handleTagInjection(payload.tag, payload.tagId);
        break;
      }
      case 'REMOVE_TAG': {
        const payload = message.payload as MessagePayloads['REMOVE_TAG'];
        this.handleTagRemoval(payload.tagId);
        break;
      }
      case 'SELECT_ELEMENT': {
        const payload = message.payload as MessagePayloads['SELECT_ELEMENT'];
        this.handleSelectedElement(payload.path);
        break;
      }
      case 'TOGGLE_SELECTION_MODE': {
        const payload = message.payload as MessagePayloads['TOGGLE_SELECTION_MODE'];
        this.handleToggleSelectionMode(payload.enabled);
        break;
      }
      case 'UPDATE_ELEMENT_STYLE': {
        const payload = message.payload as MessagePayloads['UPDATE_ELEMENT_STYLE'];
        this.handleUpdateElementStyle(payload.property, payload.value);
        break;
      }
    }
  };

  // Cleanup existing state
  private performCleanup() {
    this.state.isSelectionMode = false;
    this.clearSelection();
    this.removeInjectedTags();
    this.revertModifiedStyles();
    this.removeExtensionClasses();
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
      .${EXTENSION_SELECTION_MODE_CLASS},
      .${EXTENSION_SELECTION_MODE_CLASS} * {
        cursor: crosshair !important;
        user-select: none !important;
      }
      
      .${EXTENSION_HIGHLIGHT_CLASS} {
        outline: 2px solid #ffd700 !important;
        outline-offset: 2px;
        background-color: rgba(255, 215, 0, 0.1) !important;
        transition: all 0.2s ease;
        pointer-events: auto !important;
      }

      .${EXTENSION_SELECTED_CLASS} {
        outline: 2px solid #4682B4 !important;
        outline-offset: 2px;
        background-color: rgba(70, 130, 180, 0.1) !important;
        transition: all 0.2s ease;
      }

      html.${EXTENSION_SELECTION_MODE_CLASS},
      html.${EXTENSION_SELECTION_MODE_CLASS} body,
      html.${EXTENSION_SELECTION_MODE_CLASS} * {
        cursor: crosshair !important;
      }
    `;
  }

  private removeExtensionClasses() {
    document.documentElement.classList.remove(EXTENSION_SELECTION_MODE_CLASS);
    document.body.classList.remove(EXTENSION_SELECTION_MODE_CLASS);
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
      this.state.hoveredElement.classList.remove(EXTENSION_HIGHLIGHT_CLASS);
    }

    this.state.hoveredElement = target;
    target.classList.add(EXTENSION_HIGHLIGHT_CLASS);
  }

  private handleMouseOut(event: MouseEvent) {
    if (!this.state.isSelectionMode || !this.state.hoveredElement) return;

    const target = event.target as HTMLElement;
    if (target === this.state.hoveredElement) {
      target.classList.remove(EXTENSION_HIGHLIGHT_CLASS);
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

  // Toast notifications
  private toastNotification(message: string, type: 'success' | 'error' = 'success') {
    this.connectionManager?.sendMessage('sidepanel', {
      type: 'SHOW_TOAST',
      payload: {
        message,
        type,
      } as MessagePayloads['SHOW_TOAST'],
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

      this.tagInjection(tag, tagId, targetElement);
      this.toastNotification(chrome.i18n.getMessage('toastTagInjected'), 'success');
    } catch (error) {
      this.logger.error('Tag injection failed:', error);
      this.toastNotification(chrome.i18n.getMessage('toastTagInjectionFailed'), 'error');
    }
  }

  private handleTagRemoval(tagId: string) {
    try {
      document.querySelectorAll(`[${EXTENSION_TAG_ID_ATTRIBUTE}="${tagId}"]`).forEach((element) => {
        element.remove();
      });

      this.toastNotification(chrome.i18n.getMessage('toastTagRemoved'), 'success');
    } catch (error) {
      this.toastNotification(chrome.i18n.getMessage('toastTagRemoveFailed'), 'error');
    }
  }

  private async tagInjection(tag: string, tagId: string, targetElement: HTMLElement) {
    const fragment = this.htmlToFragment(tag);

    for (const node of Array.from(fragment.childNodes)) {
      if (node instanceof HTMLElement) {
        if (node instanceof HTMLScriptElement) {
          const params = node.src ? { url: node.src } : { script: node.textContent || '' };
          await this.processScript(params);
        } else {
          const element = node.cloneNode(true) as HTMLElement;
          element.setAttribute(EXTENSION_TAG_ID_ATTRIBUTE, tagId);
          targetElement.appendChild(element);
        }
      }
    }
  }

  private htmlToFragment(html: string): DocumentFragment {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content;
  }

  private async processScript(parames: { script: string } | { url: string }) {
    this.logger.info('processScript');

    try {
      const executeScriptPromise = new Promise<boolean>((resolve, reject) => {
        this.executeScriptPromise = { resolve, reject };

        this.connectionManager?.sendMessage('background', {
          type: 'EXECUTE_SCRIPT',
          payload: parames,
        });

        setTimeout(() => {
          if (this.executeScriptPromise) {
            reject('Script execution timed out');
            this.executeScriptPromise = null;
          }
        }, 5000);
      });

      await executeScriptPromise;
    } catch (error) {
      this.logger.error('Script execution failed:', error);
      throw error;
    }
  }

  private async handleExecutionScriptResult(success: boolean, error?: string) {
    if (this.executeScriptPromise) {
      if (success) {
        this.executeScriptPromise.resolve(true);
      } else {
        this.executeScriptPromise.reject(error || 'Script failed');
      }
    }
    this.executeScriptPromise = null;
  }

  private removeInjectedTags() {
    document.querySelectorAll(`[${EXTENSION_TAG_ID_ATTRIBUTE}]`).forEach((element) => {
      element.remove();
    });
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
    const selectedElements = document.querySelectorAll(`.${EXTENSION_SELECTED_CLASS}`);
    selectedElements.forEach((el) => {
      el.classList.remove(EXTENSION_SELECTED_CLASS);
    });

    // Clear hover, set selected element, set selected
    element.classList.remove(EXTENSION_HIGHLIGHT_CLASS);
    this.state.selectedElementInfo = createElementInfo(element);
    element.classList.add(EXTENSION_SELECTED_CLASS);

    this.logger.debug('Element selected:', this.state.selectedElementInfo);
    this.connectionManager?.sendMessage('sidepanel', {
      type: 'ELEMENT_SELECTED',
      payload: {
        elementInfo: this.state.selectedElementInfo,
      } as MessagePayloads['ELEMENT_SELECTED'],
    });
  }

  private clearSelection() {
    // Clear hovered element
    if (this.state.hoveredElement) {
      this.state.hoveredElement.classList.remove(EXTENSION_HIGHLIGHT_CLASS);
      this.state.hoveredElement = null;
    }

    // Clear selected elements
    const selectedElements = document.querySelectorAll(`.${EXTENSION_SELECTED_CLASS}`);
    selectedElements.forEach((element) => {
      element.classList.remove(EXTENSION_SELECTED_CLASS);
    });

    // Clear selected element info
    if (this.state.selectedElementInfo) {
      this.logger.debug('Element unselected:', this.state.selectedElementInfo);
      this.connectionManager?.sendMessage('sidepanel', {
        type: 'ELEMENT_UNSELECTED',
        payload: {
          elementInfo: this.state.selectedElementInfo,
        } as MessagePayloads['ELEMENT_UNSELECTED'],
      });
      this.state.selectedElementInfo = null;
    }
  }

  // Toggles selection mode
  private handleToggleSelectionMode(enabled: boolean) {
    this.state.isSelectionMode = enabled;
    if (!enabled) {
      this.logger.debug('Selection mode disabled');
      this.clearSelection();
    }

    document.documentElement.classList.toggle(EXTENSION_SELECTION_MODE_CLASS, enabled);
    document.body.classList.toggle(EXTENSION_SELECTION_MODE_CLASS, enabled);

    this.logger.debug('Selection mode toggled:', this.state.isSelectionMode);
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

      let modifiedStyles: { [key: string]: string } = {};
      const existingStyles = targetElement.getAttribute(EXTENSION_STYLE_MODIFIED_ATTRIBUTE);
      if (existingStyles) {
        modifiedStyles = JSON.parse(existingStyles);
      }

      // Update element style
      targetElement.style[property as any] = value;

      // Update modified styles
      modifiedStyles[property] = value;
      targetElement.setAttribute(
        EXTENSION_STYLE_MODIFIED_ATTRIBUTE,
        JSON.stringify(modifiedStyles)
      );

      this.logger.info('Element style updated:', {
        property,
        value,
        path: this.state.selectedElementInfo.path,
      });

      this.toastNotification(chrome.i18n.getMessage('toastStyleUpdated'), 'success');
    } catch (error) {
      this.toastNotification(chrome.i18n.getMessage('toastStyleUpdateFailed'), 'error');
    }
  }

  private revertModifiedStyles() {
    const modifiedElements = document.querySelectorAll(`[${EXTENSION_STYLE_MODIFIED_ATTRIBUTE}]`);

    modifiedElements.forEach((element) => {
      const modifiedStyles = JSON.parse(
        element.getAttribute(EXTENSION_STYLE_MODIFIED_ATTRIBUTE) || '{}'
      );

      // Reset each modified style property
      Object.keys(modifiedStyles).forEach((property) => {
        (element as HTMLElement).style[property as any] = '';
      });

      // Remove the tracking attribute
      element.removeAttribute(EXTENSION_STYLE_MODIFIED_ATTRIBUTE);
    });
  }
}

// Initialize content script
new ContentScript();
