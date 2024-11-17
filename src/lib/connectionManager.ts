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

export class ConnectionManager {
  private static instance: ConnectionManager;
  private context: Context = 'content';
  private port?: chrome.runtime.Port;
  private ports: Map<string, chrome.runtime.Port> = new Map();
  private messageHandlers: Map<MessageType, ((message: Message) => void)[]> = new Map();
  private isSettingUp = false;
  private isInvalidated = false;

  private constructor() {
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
      console.log(`[${context}] Context already set, skipping...`);
      return;
    }
    
    this.context = context;
    this.isSettingUp = false;
    this.isInvalidated = false;
    this.setupConnections();
  }

  private setupConnections() {
    this.context === 'background' 
      ? this.setupBackgroundConnections()
      : this.setupClientConnections();
  }

  private setupClientConnections() {
    if (this.isSettingUp) {
      console.log(`[${this.context}] Setup already in progress, skipping...`);
      return;
    }

    this.isSettingUp = true;
    console.log(`[${this.context}] Setting up client connections...`);
    
    // 初回接続を遅延実行
    console.log(`[${this.context}] Scheduling initial connection...`);
    setTimeout(this.connectToBackground, 100);
  }

  private connectToBackground = () => {
    try {
      console.log(`[${this.context}] Attempting to connect...`);
      this.port = chrome.runtime.connect({ name: `${this.context}-${Date.now()}` });
      console.log(`[${this.context}] Connected successfully as ${this.port.name}`);

      this.port.onMessage.addListener((message) => {
        console.log(`[${this.context}] Received message:`, message);
        this.handleMessage(message);
      });

      this.port.onDisconnect.addListener(this.handleDisconnect);

    } catch (error) {
      console.error(`[${this.context}] Connection error:`, error);
      this.scheduleReconnect();
    }
  }

  private handleDisconnect = () => {
    const error = chrome.runtime.lastError;
    console.log(`[${this.context}] Disconnected, error:`, error);
    
    if (this.isExtensionContextInvalidated(error)) {
      this.isInvalidated = true;
      console.log(`[${this.context}] Context invalidated, stopping reconnection`);
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
    if (!this.isInvalidated) {
      console.log(`[${this.context}] Scheduling reconnection...`);
      setTimeout(this.connectToBackground, 1000);
    }
  }

  private setupBackgroundConnections() {
    console.log('[background] Setting up background connections...'); 

    chrome.runtime.onConnect.addListener(port => {
      console.log(`[background] New connection from ${port.name}`);
      this.ports.set(port.name, port);

      port.onMessage.addListener((message) => {
        console.log(`[background] Received message from ${port.name}:`, message);
        this.handleMessage(message);
        this.broadcast(message, port);
      });

      port.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError;
        console.log(`[background] ${port.name} disconnected, error:`, error);
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
        console.error('Send error:', error);
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
    console.log(`${this.context} received:`, message);
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
          console.error(`Broadcast error to ${port.name}:`, error);
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