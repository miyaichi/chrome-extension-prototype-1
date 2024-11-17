// src/sidepanel/App.tsx
import React, { useEffect, useState } from 'react';
import { ConnectionManager, Message, useConnectionManager } from '../lib/connectionManager';

class Logger {
  log(message: string, ...args: any[]) {
    console.log(`[sidepanel] ${message}`, ...args);
  }

  error(message: string, ...args: any[]) {
    console.error(`[sidepanel] ${message}`, ...args);
  }
}

export const App = () => {
  const { sendMessage, subscribe } = useConnectionManager();
  const [messages, setMessages] = useState<Message[]>([]);
  const [connected, setConnected] = useState(false);
  const logger = new Logger();

  useEffect(() => {
    ConnectionManager.getInstance().setContext('sidepanel');

    const initConnection = async () => {
      try {
        await sendMessage('SIDE_PANEL_READY', { timestamp: Date.now() });
        setConnected(true);
      } catch (error) {
        logger.error('Connection error:', error);
        setConnected(false);
      }
    };

    initConnection();

    const unsubscribe = subscribe('*' as any, (message: Message) => {
      setMessages(prev => [...prev, message].slice(-50));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleSendTest = () => {
    sendMessage('TEST_MESSAGE', {
      text: 'Test message from Side Panel',
      timestamp: Date.now()
    });
  };
  
  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold mb-2">Message Monitor</h1>
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <button
          onClick={handleSendTest}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Send Test Message
        </button>
      </div>
      
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-100 px-4 py-2 font-medium">Messages</div>
        <div className="h-[500px] overflow-y-auto">
          {messages.map((message) => (
            <div key={message.id} className="px-4 py-2 border-t">
              <div className="flex justify-between text-sm text-gray-500">
                <span>{message.source} → {message.target || 'all'}</span>
                <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="font-medium">{message.type}</div>
              <pre className="text-sm bg-gray-50 p-2 rounded mt-1">
                {JSON.stringify(message.payload, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}