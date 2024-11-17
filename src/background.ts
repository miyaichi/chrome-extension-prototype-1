// src/background.ts
import { ConnectionManager, Message } from './lib/connectionManager';

class BackgroundService {
  private manager: ConnectionManager;

  constructor() {
    console.log('Initializing BackgroundService...');
    this.manager = ConnectionManager.getInstance();
    console.log('Setting background context...');
    this.manager.setContext('background');
    console.log('Setting up event handlers...');
    this.setupEventHandlers();
    console.log('BackgroundService initialization complete');
    
    // 初期設定を実行
    this.setupSidePanel();
  }

  private setupEventHandlers() {
    // メッセージのモニタリング（全メッセージをログ出力）
    this.manager.subscribe('*' as any, (message: Message) => {
      const timestamp = new Date(message.timestamp).toISOString();
      console.log(`[${timestamp}] ${message.source} -> ${message.target || 'broadcast'}: ${message.type}`, message.payload);
    });

    // イベントハンドラの登録
    chrome.runtime.onInstalled.addListener(() => {
      console.log('Extension installed/updated');
      this.setupSidePanel();
    });

    chrome.action.onClicked.addListener(this.toggleSidePanel);
    chrome.tabs.onActivated.addListener(this.handleTabActivated.bind(this));
  }

  private async handleTabActivated({ tabId, windowId }: chrome.tabs.TabActiveInfo) {
    try {
      const tab = await chrome.tabs.get(tabId);
      await this.manager.sendMessage('TAB_ACTIVATED', {
        tabId,
        windowId,
        url: tab.url,
        title: tab.title
      });
    } catch (error) {
      console.error('Tab activation error:', error);
    }
  }

  private async setupSidePanel() {
    try {
      await chrome.sidePanel.setOptions({
        enabled: true,
        path: 'sidepanel.html'
      });
      console.log('Side panel settings updated');
    } catch (error) {
      console.error('Failed to setup side panel:', error);
    }
  }

  private toggleSidePanel = (tab: chrome.tabs.Tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.error('Failed to open side panel:', error);
      } else {
        console.log('Side panel opened successfully');
      }
    });
  }
}

// サービスの起動
new BackgroundService();