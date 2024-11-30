import { nanoid } from 'nanoid';
import { Context, Message, MessageType, Messages } from '../types/messages';
import { getTabIdFromContext, isContentScriptContext } from '../utils/contextHelpers';
import { Logger } from './logger';
import { loadSettings } from './settings';

interface IConnectionManager {
  sendMessage<T extends MessageType>(
    type: T,
    payload: Messages[T],
    target?: Context
  ): Promise<void>;

  subscribe<T extends MessageType>(
    messageType: T,
    handler: (message: Message<Messages[T]>) => void
  ): () => void;
}

interface ConnectionState {
  isSettingUp: boolean;
  isInvalidated: boolean;
  messageQueue: Message[];
  port?: chrome.runtime.Port;
}

export class ConnectionManager implements IConnectionManager {
  private static instance: ConnectionManager;
  private static readonly RECONNECT_DELAY = 1000;
  private static readonly INITIAL_CONNECTION_DELAY = 100;
  private static readonly MESSAGE_CLEANUP_DELAY = 5000;

  private context: Context = 'undefined';
  private ports: Map<string, chrome.runtime.Port> = new Map();
  private messageHandlers: Map<MessageType, ((message: Message) => void)[]> = new Map();
  private processedMessageIds: Set<string> = new Set();
  private state: ConnectionState = {
    isSettingUp: false,
    isInvalidated: false,
    messageQueue: [],
    port: undefined,
  };
  private logger: Logger;

  private constructor() {
    this.logger = new Logger(this.context);
    this.initializeConnection();
  }

  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  private async initializeConnection() {
    await this.initializeLogger();
    this.setupConnections();
  }

  private async initializeLogger() {
    const settings = await loadSettings();
    Logger.setLogLevel(settings.logLevel);
    this.setupLogLevelListener();
  }

  private setupLogLevelListener() {
    if (chrome.storage?.sync) {
      chrome.storage.sync.onChanged.addListener((changes) => {
        if (changes.settings?.newValue?.logLevel) {
          Logger.setLogLevel(changes.settings.newValue.logLevel);
        }
      });
    }
  }

  public setContext(context: Context) {
    this.logger.debug('Setting context:', context);
    this.context = context;
    this.logger = new Logger(context);
    this.resetState();
    this.setupConnections();
  }

  private resetState() {
    this.state = {
      isSettingUp: false,
      isInvalidated: false,
      messageQueue: [],
      port: undefined,
    };
    this.processedMessageIds.clear();
  }

  private setupConnections() {
    this.context === 'background'
      ? this.setupBackgroundConnections()
      : this.setupClientConnections();
  }

  private setupClientConnections() {
    if (this.state.isSettingUp) {
      this.logger.debug('Setup already in progress, skipping...');
      return;
    }

    this.state.isSettingUp = true;
    this.logger.debug('Setting up client connections...');
    setTimeout(this.connectToBackground, ConnectionManager.INITIAL_CONNECTION_DELAY);
  }

  private connectToBackground = () => {
    if (this.context === 'background') {
      this.logger.debug('Skipping connection as background context');
      return;
    }

    try {
      this.state.port = chrome.runtime.connect({
        name: `${this.context}-${Date.now()}`,
      });
      this.logger.log(`Connected successfully as ${this.state.port.name}`);

      this.setupClientMessageHandling(this.state.port);
      this.state.port.onDisconnect.addListener(this.handleDisconnect);
      this.flushMessageQueue();
    } catch (error) {
      this.handleConnectionError(error);
    }
  };

  private setupClientMessageHandling(port: chrome.runtime.Port) {
    port.onMessage.addListener((message: Message) => {
      this.logger.debug('Received message:', message);
      this.processMessageIfNew(message);
    });
  }

  private processMessageIfNew(message: Message) {
    if (!this.processedMessageIds.has(message.id)) {
      this.processedMessageIds.add(message.id);
      this.handleMessage(message);
      this.scheduleMessageCleanup(message.id);
    }
  }

  private setupBackgroundConnections() {
    this.logger.debug('Setting up background connections...');

    chrome.runtime.onConnect.addListener((port) => {
      this.handleNewConnection(port);
    });
  }

  private handleNewConnection(port: chrome.runtime.Port) {
    this.logger.log(`New connection from ${port.name}`);
    this.ports.set(port.name, port);

    port.onMessage.addListener((message: Message) => {
      this.handleBackgroundMessage(message, port);
    });

    port.onDisconnect.addListener(() => {
      this.handlePortDisconnection(port);
    });
  }

  private handleBackgroundMessage(message: Message, sourcePort: chrome.runtime.Port) {
    this.logger.debug(`Received message from ${sourcePort.name}:`, message);

    if (this.processedMessageIds.has(message.id)) {
      this.logger.debug(`Skipping already processed message: ${message.id}`);
      return;
    }

    this.processedMessageIds.add(message.id);
    this.scheduleMessageCleanup(message.id);

    if (message.target) {
      this.routeMessageToTarget(message, sourcePort);
    } else {
      this.broadcast(message, sourcePort);
    }

    this.handleMessage(message);
  }

  private routeMessageToTarget(message: Message, sourcePort: chrome.runtime.Port) {
    const targetPorts = Array.from(this.ports.entries())
      .filter(([name]) => name.startsWith(message.target!))
      .map(([, port]) => port);

    targetPorts.forEach((targetPort) => {
      if (targetPort !== sourcePort) {
        targetPort.postMessage(message);
      }
    });
  }

  private handlePortDisconnection(port: chrome.runtime.Port) {
    const error = chrome.runtime.lastError;
    this.logger.debug(`${port.name} disconnected, error:`, error);
    this.ports.delete(port.name);
  }

  private handleConnectionError(error: unknown) {
    this.logger.error('Connection error:', error);
    this.scheduleReconnect();
  }

  private handleDisconnect = () => {
    const error = chrome.runtime.lastError;
    this.logger.debug('Disconnected, error:', error);

    if (this.isExtensionContextInvalidated(error)) {
      this.state.isInvalidated = true;
      this.logger.log('Context invalidated, stopping reconnection');
      return;
    }

    if (this.context === 'background') {
      this.logger.debug('Skipping reconnection as background context');
      return;
    }

    this.state.port = undefined;
    this.scheduleReconnect();
  };

  private scheduleReconnect() {
    if (this.context === 'background' || this.state.isInvalidated) return;

    this.logger.debug('Scheduling reconnection...');
    setTimeout(this.connectToBackground, ConnectionManager.RECONNECT_DELAY);
  }

  public async sendMessage<T extends MessageType>(
    type: T,
    payload: Messages[T],
    target?: Context
  ): Promise<void> {
    const message = this.createMessage(type, payload, target);

    try {
      await this.deliverMessage(message);
    } catch (error) {
      this.logger.error('Send error:', error);
    }
  }

  private createMessage<T extends MessageType>(
    type: T,
    payload: Messages[T],
    target?: Context
  ): Message<Messages[T]> {
    return {
      id: nanoid(),
      type,
      payload,
      source: this.context,
      target,
      timestamp: Date.now(),
    };
  }

  private async deliverMessage(message: Message): Promise<void> {
    if (this.context === 'background') {
      this.broadcast(message);
    } else if (this.state.port) {
      this.state.port.postMessage(message);
    } else {
      this.state.messageQueue.push(message);
      this.logger.debug('Message queued:', message);
    }
  }

  public subscribe<T extends MessageType>(
    messageType: T,
    handler: (message: Message<Messages[T]>) => void
  ): () => void {
    const handlers = this.messageHandlers.get(messageType) || [];
    handlers.push(handler as (message: Message) => void);
    this.messageHandlers.set(messageType, handlers);

    return () => this.unsubscribeHandler(messageType, handler);
  }

  private unsubscribeHandler<T extends MessageType>(
    messageType: T,
    handler: (message: Message<Messages[T]>) => void
  ) {
    const handlers = this.messageHandlers.get(messageType) || [];
    const index = handlers.indexOf(handler as (message: Message) => void);
    if (index > -1) {
      handlers.splice(index, 1);
      this.messageHandlers.set(messageType, handlers);
    }
  }

  private handleMessage(message: Message) {
    this.logger.debug('Handling message:', message, this.context);
    const handlers = [
      ...(this.messageHandlers.get(message.type) || []),
      ...(this.messageHandlers.get('DEBUG' as MessageType) || []),
    ];
    handlers.forEach((handler) => handler(message));
  }

  private broadcast(message: Message, excludePort?: chrome.runtime.Port) {
    if (this.context !== 'background') return;

    this.ports.forEach((port) => {
      // Only broadcast to content script contexts if target is specified
      if (message.target && isContentScriptContext(message.target)) {
        const targetTabId = getTabIdFromContext(message.target);
        const portTabId = getTabIdFromContext(port.name as Context);
        if (targetTabId !== portTabId) return;
      }

      if (port !== excludePort) {
        try {
          port.postMessage(message);
          this.logger.debug(`Broadcast message to ${port.name}:`, message);
        } catch (error) {
          this.logger.error(`Broadcast error to ${port.name}:`, error);
        }
      }
    });
  }

  private scheduleMessageCleanup(messageId: string) {
    setTimeout(() => {
      this.processedMessageIds.delete(messageId);
    }, ConnectionManager.MESSAGE_CLEANUP_DELAY);
  }

  private async flushMessageQueue() {
    this.logger.debug(`Flushing message queue (${this.state.messageQueue.length} messages)`);
    while (this.state.messageQueue.length > 0) {
      const message = this.state.messageQueue.shift();
      if (message && this.state.port) {
        try {
          this.state.port.postMessage(message);
          this.logger.debug('Queued message sent:', message);
        } catch (error) {
          this.logger.error('Failed to send queued message:', error);
          this.state.messageQueue.unshift(message);
          break;
        }
      }
    }
  }

  private isExtensionContextInvalidated(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;

    return (
      'message' in error &&
      typeof (error as { message: unknown }).message === 'string' &&
      (error as { message: string }).message.includes('Extension context invalidated')
    );
  }
}

export const useConnectionManager = () => {
  const manager = ConnectionManager.getInstance();
  return {
    sendMessage: manager.sendMessage.bind(manager),
    subscribe: manager.subscribe.bind(manager),
  } as const;
};
