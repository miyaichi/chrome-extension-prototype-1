// src/contentScript.ts
import { ConnectionManager, useConnectionManager } from './lib/connectionManager';

const { sendMessage, subscribe } = useConnectionManager();

ConnectionManager.getInstance().setContext('content');

sendMessage('CONTENT_READY', { url: window.location.href });