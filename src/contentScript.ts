// src/contentScript.ts
import { ConnectionManager, useConnectionManager } from './lib/connectionManager';

const { sendMessage, subscribe } = useConnectionManager();
// コンテキストを設定
ConnectionManager.getInstance().setContext('content');

// Content Scriptの準備完了通知
sendMessage('CONTENT_READY', { url: window.location.href });