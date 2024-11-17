// src/lib/connectionManager.ts
import { nanoid } from 'nanoid';

export type MessageType = 
  | 'SIDE_PANEL_READY'
  | 'CONTENT_READY'
  | 'TAB_ACTIVATED'
  | 'TEST_MESSAGE';

export type Context = 'content' | 'background' | 'sidepanel';

export interface Message<T = any> {
  id: string;
  type: MessageType;
  payload: T;
  source: Context;
  target?: Context;
  timestamp: number;
}

class Logger {
  constructor(private context: Context) {}

  log(message: string, ...args: any[]) {
    console.log(`[${this.context}] ${message}`, ...args);
  }

  error(message: string, ...args: any[]) {
    console.error(`[${this.context}] ${message}`, ...args);
  }
}

export class ConnectionManager {
  private static instance: ConnectionManager; // Singleton instance
  private static readonly RECONNECT_DELAY = 1000;
  private static readonly INITIAL_CONNECTION_DELAY = 100;
  private context: Context = 'content';
  private port?: chrome.runtime.Port;
  private ports: Map<string, chrome.runtime.Port> = new Map();
  private messageHandlers: Map<MessageType, ((message: Message) => void)[]> = new Map();
  private isSettingUp = false;
  private isInvalidated = false;
  private logger: Logger;

  private constructor() {
    this.logger = new Logger(this.context);
    this.setupConnections();
  }

  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  public setContext(context: Context) {
    if (this.context === context) {
      this.logger.log('Context already set, skipping...');
      return;
    }
    
    this.context = context;
    this.logger = new Logger(context);
    this.isSettingUp = false;
    this.isInvalidated = false;
    this.setupConnections();
  }

  private setupConnections() {
    if (this.context === 'background') {
      this.setupBackgroundConnections();
      return;
    }
    
    this.setupClientConnections();
  }

  private setupClientConnections() {
    if (this.isSettingUp) {
      this.logger.log('Setup already in progress, skipping...');
      return;
    }

    this.isSettingUp = true;
    this.logger.log('Setting up client connections...');
    
    this.logger.log('Scheduling initial connection...');
    setTimeout(this.connectToBackground, ConnectionManager.INITIAL_CONNECTION_DELAY);
  }

  private connectToBackground = () => {
    if (this.context === 'background') {
      this.logger.log('Skipping connection as background context');
      return;
    }

    try {
      this.logger.log('Attempting to connect...');
      this.port = chrome.runtime.connect({ name: `${this.context}-${Date.now()}` });
      this.logger.log(`Connected successfully as ${this.port.name}`);

      this.port.onMessage.addListener((message) => {
        this.logger.log('Received message:', message);
        this.handleMessage(message);
      });

      this.port.onDisconnect.addListener(this.handleDisconnect);

    } catch (error) {
      this.logger.error('Connection error:', error);
      this.scheduleReconnect();
    }
  }

  private handleDisconnect = () => {
    const error = chrome.runtime.lastError;
    this.logger.log('Disconnected, error:', error);
    
    if (this.isExtensionContextInvalidated(error)) {
      this.isInvalidated = true;
      this.logger.log('Context invalidated, stopping reconnection');
      return;
    }

    if (this.context === 'background') {
      this.logger.log('Skipping reconnection as background context');
      return;
    }

    this.port = undefined;
    this.scheduleReconnect();
  }

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
      this.logger.log('Scheduling reconnection...');
      setTimeout(this.connectToBackground, ConnectionManager.RECONNECT_DELAY);
    }
  }

  private setupBackgroundConnections() {
    this.logger.log('Setting up background connections...'); 

    chrome.runtime.onConnect.addListener(port => {
      this.logger.log(`New connection from ${port.name}`);
      this.ports.set(port.name, port);

      port.onMessage.addListener((message) => {
        this.logger.log(`Received message from ${port.name}:`, message);
        this.handleMessage(message);
        this.broadcast(message, port);
      });

      port.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError;
        this.logger.log(`${port.name} disconnected, error:`, error);
        this.ports.delete(port.name);
      });
    });
  }

  public sendMessage<T>(
    type: MessageType,
    payload: T,
    target?: Context
  ): Promise<void> {
    const message: Message<T> = {
      id: nanoid(),
      type,
      payload,
      source: this.context,
      target,
      timestamp: Date.now()
    };

    return new Promise(resolve => {
      try {
        if (this.context === 'background') {
          this.broadcast(message);
        } else if (this.port) {
          this.port.postMessage(message);
        }
      } catch (error) {
        this.logger.error('Send error:', error);
      }
      resolve();
    });
  }

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
    this.logger.log('received:', message);
    const handlers = this.messageHandlers.get(message.type) || [];
    handlers.forEach(handler => handler(message));
  }

  private broadcast(message: Message, excludePort?: chrome.runtime.Port) {
    if (this.context !== 'background') return;

    this.ports.forEach(port => {
      if (port !== excludePort) {
        try {
          port.postMessage(message);
        } catch (error) {
          this.logger.error(`Broadcast error to ${port.name}:`, error);
        }
      }
    });
  }
}

export const useConnectionManager = () => {
  const manager = ConnectionManager.getInstance();
  return {
    sendMessage: manager.sendMessage.bind(manager),
    subscribe: manager.subscribe.bind(manager)
  };
};