import { nanoid } from 'nanoid';
import { Logger } from './logger';
import { loadSettings } from './settings';

/**
 * Type representing the different message types that can be sent
 */
export type MessageType =
  | 'SIDE_PANEL_READY'
  | 'SIDE_PANEL_CLOSED'
  | 'CONTENT_READY'
  | 'TAB_ACTIVATED'
  | 'TAB_UPDATED'
  | 'TOGGLE_SELECTION_MODE'
  | 'ELEMENT_SELECTED'
  | 'ELEMENT_UNSELECTED'
  | 'SELECT_ELEMENT'
  | 'CLEAR_SELECTION'
  | 'UPDATE_ELEMENT_STYLE'
  | 'CAPTURE_TAB'
  | 'CAPTURE_TAB_RESULT'
  | 'DEBUG'; // Special message type for debugging purposes - handlers will receive all messages for logging/monitoring

/**
 * Type representing the different contexts in which messages can be sent
 */
export type Context = 'content' | 'background' | 'sidepanel';

/**
 * Interface representing a message that can be sent between different contexts
 * @template T - The type of the payload
 */
export interface Message<T = any> {
  /** The unique identifier for the message */
  id: string;
  /** The type of the message */
  type: MessageType;
  /** The payload of the message */
  payload: T;
  /** The source context of the message */
  source: Context;
  /** The target context of the message (optional) */
  target?: Context;
  /** The timestamp when the message was created */
  timestamp: number;
}

/**
 * A singleton class that manages connections and message passing between different contexts
 * in a Chrome extension (background, content scripts, and side panel).
 * Handles connection management, reconnection logic, and message broadcasting.
 */
export class ConnectionManager {
  private static instance: ConnectionManager;
  private static readonly RECONNECT_DELAY = 1000;
  private static readonly INITIAL_CONNECTION_DELAY = 100;
  private context: Context = 'content';
  private port?: chrome.runtime.Port;
  private ports: Map<string, chrome.runtime.Port> = new Map();
  private messageHandlers: Map<MessageType, ((message: Message) => void)[]> = new Map();
  private isSettingUp = false;
  private isInvalidated = false;
  private logger: Logger;
  private messageQueue: Message[] = [];

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.logger = new Logger(this.context);
    this.setupConnections();
    this.initializeLogger();
  }

  /**
   * Initializes the logger with settings from storage
   */
  private async initializeLogger() {
    const settings = await loadSettings();
    Logger.setLogLevel(settings.logLevel);

    if (chrome.storage?.sync) {
      chrome.storage.sync.onChanged.addListener((changes) => {
        if (changes.settings?.newValue?.logLevel) {
          Logger.setLogLevel(changes.settings.newValue.logLevel);
        }
      });
    }
  }

  /**
   * Sets up connections for the ConnectionManager
   */
  private setupConnections() {
    if (this.context === 'background') {
      this.setupBackgroundConnections();
      return;
    }

    this.setupClientConnections();
  }

  /**
   * Gets the singleton instance of the ConnectionManager
   * @returns The singleton instance of the ConnectionManager
   */
  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  /**
   * Sets the context for the ConnectionManager instance and reinitializes connections
   * @param context - The new context to set ('content', 'background', or 'sidepanel')
   */
  public setContext(context: Context) {
    if (this.context === context) {
      this.logger.debug('Context already set, skipping...');
      return;
    }

    this.context = context;
    this.logger = new Logger(context);
    this.isSettingUp = false;
    this.isInvalidated = false;
    this.setupConnections();
  }

  private setupClientConnections() {
    if (this.isSettingUp) {
      this.logger.debug('Setup already in progress, skipping...');
      return;
    }

    this.isSettingUp = true;
    this.logger.debug('Setting up client connections...');

    this.logger.debug('Scheduling initial connection...');
    setTimeout(this.connectToBackground, ConnectionManager.INITIAL_CONNECTION_DELAY);
  }

  private connectToBackground = () => {
    if (this.context === 'background') {
      this.logger.debug('Skipping connection as background context');
      return;
    }

    try {
      this.logger.debug('Attempting to connect...');
      this.port = chrome.runtime.connect({
        name: `${this.context}-${Date.now()}`,
      });
      this.logger.log(`Connected successfully as ${this.port.name}`);

      this.port.onMessage.addListener((message) => {
        this.logger.debug('Received message:', message);
        this.handleMessage(message);
      });

      this.port.onDisconnect.addListener(this.handleDisconnect);
      this.flushMessageQueue();
    } catch (error) {
      this.logger.error('Connection error:', error);
      this.scheduleReconnect();
    }
  };

  private handleDisconnect = () => {
    const error = chrome.runtime.lastError;
    this.logger.debug('Disconnected, error:', error);

    if (this.isExtensionContextInvalidated(error)) {
      this.isInvalidated = true;
      this.logger.log('Context invalidated, stopping reconnection');
      return;
    }

    if (this.context === 'background') {
      this.logger.debug('Skipping reconnection as background context');
      return;
    }

    this.port = undefined;
    this.scheduleReconnect();
  };

  private isExtensionContextInvalidated(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    return (
      'message' in error &&
      typeof (error as { message: unknown }).message === 'string' &&
      (error as { message: string }).message.includes('Extension context invalidated')
    );
  }

  private scheduleReconnect() {
    if (this.context === 'background') {
      return;
    }

    if (!this.isInvalidated) {
      this.logger.debug('Scheduling reconnection...');
      setTimeout(this.connectToBackground, ConnectionManager.RECONNECT_DELAY);
    }
  }

  private setupBackgroundConnections() {
    this.logger.debug('Setting up background connections...');

    chrome.runtime.onConnect.addListener((port) => {
      this.logger.log(`New connection from ${port.name}`);
      this.ports.set(port.name, port);

      port.onMessage.addListener((message) => {
        this.logger.debug(`Received message from ${port.name}:`, message);
        this.handleMessage(message);
        this.broadcast(message, port);
      });

      port.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError;
        this.logger.debug(`${port.name} disconnected, error:`, error);
        this.ports.delete(port.name);
      });
    });
  }

  /**
   * Sends a message to the specified target context
   * @param message - The message to send
   */
  public sendMessage<T>(type: MessageType, payload: T, target?: Context): Promise<void> {
    const message: Message<T> = {
      id: nanoid(),
      type,
      payload,
      source: this.context,
      target,
      timestamp: Date.now(),
    };

    return new Promise((resolve) => {
      try {
        if (this.context === 'background') {
          this.broadcast(message);
        } else if (this.port) {
          this.port.postMessage(message);
        } else {
          this.messageQueue.push(message);
          this.logger.debug('Message queued:', message);
        }
      } catch (error) {
        this.logger.error('Send error:', error);
      }
      resolve();
    });
  }

  /**
   * Adds a message handler for a specific message type
   * @param type - The type of message to handle
   * @param handler - The handler function for the message
   */
  public addMessageHandler(type: MessageType, handler: (message: Message) => void) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler);
  }

  /**
   * Removes a message handler for a specific message type
   * @param type - The type of message to remove the handler for
   * @param handler - The handler function to remove
   */
  public removeMessageHandler(type: MessageType, handler: (message: Message) => void) {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      this.messageHandlers.set(
        type,
        handlers.filter((h) => h !== handler)
      );
    }
  }

  /**
   * Subscribes to messages of a specific type with a handler function
   * @template T - The type of the message payload
   * @param messageType - The type of message to subscribe to
   * @param handler - The handler function to be called when a message is received
   * @returns A function to unsubscribe the handler
   */
  public subscribe<T>(
    messageType: MessageType,
    handler: (message: Message<T>) => void
  ): () => void {
    const handlers = this.messageHandlers.get(messageType) || [];
    handlers.push(handler as (message: Message) => void);
    this.messageHandlers.set(messageType, handlers);

    return () => {
      const handlers = this.messageHandlers.get(messageType) || [];
      const index = handlers.indexOf(handler as (message: Message) => void);
      if (index > -1) {
        handlers.splice(index, 1);
        this.messageHandlers.set(messageType, handlers);
      }
    };
  }

  private handleMessage(message: Message) {
    this.logger.debug('received:', message);
    const handlers = this.messageHandlers.get(message.type) || [];
    const debugHandlers = this.messageHandlers.get('DEBUG') || [];
    [...handlers, ...debugHandlers].forEach((handler) => handler(message));
  }

  private broadcast(message: Message, excludePort?: chrome.runtime.Port) {
    if (this.context !== 'background') return;

    this.ports.forEach((port) => {
      if (port !== excludePort) {
        try {
          port.postMessage(message);
        } catch (error) {
          this.logger.error(`Broadcast error to ${port.name}:`, error);
        }
      }
    });
  }

  private async flushMessageQueue() {
    this.logger.debug(`Flushing message queue (${this.messageQueue.length} messages)`);
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message && this.port) {
        try {
          this.port.postMessage(message);
          this.logger.debug('Queued message sent:', message);
        } catch (error) {
          this.logger.error('Failed to send queued message:', error);
          this.messageQueue.unshift(message);
          break;
        }
      }
    }
  }
}

/**
 * A hook that provides access to ConnectionManager instance methods
 * @returns An object containing message sending and subscription methods
 */
export const useConnectionManager = () => {
  const manager = ConnectionManager.getInstance();
  return {
    sendMessage: manager.sendMessage.bind(manager),
    subscribe: manager.subscribe.bind(manager),
  };
};
