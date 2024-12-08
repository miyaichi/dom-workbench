import { ConnectionManager } from '../lib/connectionManager';
import { Logger } from '../lib/logger';
import { MessageHandler, MessagePayloads } from '../types/messages';
import { ElementInfo } from '../types/types';
import { createElementInfo, getElementByPath } from '../utils/domSelection';
import { htmlToDoc } from '../utils/htmlToDoc';

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

  constructor() {
    this.logger = new Logger('content-script');
    this.initialize();

    this.injectStyles();
    this.setupEventListeners();
  }

  private async initialize() {
    try {
      // Listen for PING and SIDEPANEL_CLOSED messages
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

  // Send current state to sidepanel
  private async handleGetCurrentState() {
    this.logger.info('Sending current state', this.state);
    this.connectionManager?.sendMessage('sidepanel', {
      type: 'CONTENT_STATE_UPDATE',
      payload: {
        isSelectionMode: this.state.isSelectionMode,
        selectedElementInfo: this.state.selectedElementInfo,
      } as MessagePayloads['CONTENT_STATE_UPDATE'],
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

      const domElement = await htmlToDoc(tag, {
        async: true,
        preserveOrder: true,
        onScriptsLoaded: () => {
          this.logger.debug(`Scripts loaded for tag ${tagId}`);
          this.connectionManager?.sendMessage('sidepanel', {
            type: 'SHOW_TOAST',
            payload: {
              message: chrome.i18n.getMessage('toastTagLoaded'),
              type: 'success',
            } as MessagePayloads['SHOW_TOAST'],
          });
        },
      });

      // Set tag ID to the root element of the injected tag
      if (domElement instanceof DocumentFragment) {
        Array.from(domElement.children).forEach((child) => {
          child.setAttribute(EXTENSION_TAG_ID_ATTRIBUTE, tagId);
        });
      } else if (domElement instanceof Element) {
        domElement.setAttribute(EXTENSION_TAG_ID_ATTRIBUTE, tagId);
      }

      targetElement.appendChild(domElement);

      this.logger.info('Tag injected successfully:', {
        tagId,
        targetPath: this.state.selectedElementInfo.path,
      });

      this.connectionManager?.sendMessage('sidepanel', {
        type: 'SHOW_TOAST',
        payload: {
          message: chrome.i18n.getMessage('toastTagInjected'),
          type: 'success',
        } as MessagePayloads['SHOW_TOAST'],
      });
    } catch (error) {
      this.logger.error('Tag injection failed:', error);
      this.connectionManager?.sendMessage('sidepanel', {
        type: 'SHOW_TOAST',
        payload: {
          message: chrome.i18n.getMessage('toastTagInjected'),
          type: 'error',
        } as MessagePayloads['SHOW_TOAST'],
      });
    }
  }

  private handleTagRemoval(tagId: string) {
    try {
      const injectedElements = document.querySelectorAll(
        `[${EXTENSION_TAG_ID_ATTRIBUTE}="${tagId}"]`
      );

      if (injectedElements.length === 0) {
        throw new Error(`No elements found with tag ID: ${tagId}`);
      }

      injectedElements.forEach((element) => {
        element.remove();
      });

      this.logger.info('Tag removed successfully:', { tagId });

      this.connectionManager?.sendMessage('sidepanel', {
        type: 'SHOW_TOAST',
        payload: {
          message: chrome.i18n.getMessage('toastTagRemoved'),
          type: 'success',
        } as MessagePayloads['SHOW_TOAST'],
      });
    } catch (error) {
      this.logger.error('Tag removal failed:', error);
      this.connectionManager?.sendMessage('sidepanel', {
        type: 'SHOW_TOAST',
        payload: {
          message: chrome.i18n.getMessage('toastTagRemoveFailed'),
          type: 'error',
        } as MessagePayloads['SHOW_TOAST'],
      });
    }
  }

  private removeInjectedTags() {
    const EXTENSION_TAG_ID_ATTRIBUTE = 'data-injected-tag-id';
    const injectedElements = document.querySelectorAll(`[${EXTENSION_TAG_ID_ATTRIBUTE}]`);
    injectedElements.forEach((element) => {
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
    if (this.state.isSelectionMode === enabled) return;

    this.state.isSelectionMode = enabled;
    if (!enabled) {
      this.clearSelection();
    }

    document.documentElement.classList.toggle(EXTENSION_SELECTION_MODE_CLASS, enabled);
    document.body.classList.toggle(EXTENSION_SELECTION_MODE_CLASS, enabled);

    this.connectionManager?.sendMessage('sidepanel', {
      type: 'SELECTION_MODE_TOGGLED',
      payload: {
        enabled: enabled,
      } as MessagePayloads['SELECTION_MODE_TOGGLED'],
    });

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

      this.connectionManager?.sendMessage('sidepanel', {
        type: 'SHOW_TOAST',
        payload: {
          message: chrome.i18n.getMessage('toastStyleUpdated'),
          type: 'success',
        } as MessagePayloads['SHOW_TOAST'],
      });
    } catch (error) {
      this.logger.error('Element style update failed:', error);
      this.connectionManager?.sendMessage('sidepanel', {
        type: 'SHOW_TOAST',
        payload: {
          message: chrome.i18n.getMessage('toastStyleUpdateFailed'),
          type: 'error',
        } as MessagePayloads['SHOW_TOAST'],
      });
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
