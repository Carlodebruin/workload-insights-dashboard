'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare, User, Clock, CheckCircle, AlertCircle, ExternalLink, Plus } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import Spinner from '../components/Spinner';

interface WhatsAppMessage {
  id: string;
  waId: string;
  from: string;
  type: string;
  content: string;
  timestamp: string;
  direction: string;
  status: string;
  processed: boolean;
  relatedActivityId?: string;
  sender: {
    name: string;
    phone: string;
    linkedUser?: {
      name: string;
      role: string;
    };
  };
  activity?: {
    id: string;
    category_id: string;
    location: string;
    status: string;
  };
}

interface WhatsAppMessagesPageProps {
  onConvertToActivity?: (message: WhatsAppMessage) => void;
}

export default function WhatsAppMessagesPage({ onConvertToActivity }: WhatsAppMessagesPageProps) {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/whatsapp-messages?limit=50');
      if (!response.ok) throw new Error('Failed to fetch messages');
      
      const data = await response.json();
      setMessages(data.messages);
      console.log('📱 Loaded WhatsApp messages:', data.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
      console.error('❌ Error loading messages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, []);

  const markAsProcessed = async (messageId: string) => {
    try {
      const response = await fetch('/api/whatsapp-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, action: 'mark_processed' })
      });

      if (!response.ok) throw new Error('Failed to mark message as processed');

      // Update local state
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId ? { ...msg, processed: true } : msg
        )
      );

      addToast('Success', 'Message marked as processed', 'success');
    } catch (err) {
      addToast('Error', 'Failed to mark message as processed', 'error');
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString();
    } else {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }
  };

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'text':
        return '💬';
      case 'image':
        return '📸';
      case 'location':
        return '📍';
      case 'document':
        return '📄';
      case 'voice':
        return '🎵';
      default:
        return '📨';
    }
  };

  const getStatusColor = (processed: boolean, hasActivity: boolean) => {
    if (hasActivity) return 'text-green-600 bg-green-50';
    if (processed) return 'text-blue-600 bg-blue-50';
    return 'text-orange-600 bg-orange-50';
  };

  const getStatusText = (processed: boolean, hasActivity: boolean) => {
    if (hasActivity) return 'Converted';
    if (processed) return 'Processed';
    return 'New';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Spinner />
        <span className="ml-2">Loading WhatsApp messages...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">Error Loading Messages</h3>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={fetchMessages}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <MessageSquare className="w-6 h-6 mr-2" />
            WhatsApp Messages
          </h1>
          <p className="text-gray-600">
            Incoming WhatsApp messages - {messages.length} total
          </p>
        </div>
        <button
          onClick={fetchMessages}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {messages.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">No Messages Yet</h3>
          <p className="text-gray-600">WhatsApp messages will appear here when received</p>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sender
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Message
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {messages.map((message) => (
                  <tr key={message.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="w-5 h-5 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {message.sender.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {message.sender.phone}
                          </div>
                          {message.sender.linkedUser && (
                            <div className="text-xs text-blue-600">
                              Linked: {message.sender.linkedUser.name} ({message.sender.linkedUser.role})
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start">
                        <span className="text-lg mr-2">
                          {getMessageTypeIcon(message.type)}
                        </span>
                        <div>
                          <div className="text-sm text-gray-900 max-w-md">
                            {message.content}
                          </div>
                          <div className="text-xs text-gray-500">
                            Type: {message.type}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {formatTimestamp(message.timestamp)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(message.processed, !!message.activity)}`}>
                        {getStatusText(message.processed, !!message.activity)}
                      </span>
                      {message.activity && (
                        <div className="text-xs text-gray-500 mt-1">
                          Activity: {message.activity.location}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      {!message.processed && !message.activity && (
                        <>
                          <button
                            onClick={() => onConvertToActivity?.(message)}
                            className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Convert to Activity
                          </button>
                          <button
                            onClick={() => markAsProcessed(message.id)}
                            className="text-gray-600 hover:text-gray-900 inline-flex items-center"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Mark Processed
                          </button>
                        </>
                      )}
                      {message.activity && (
                        <a
                          href={`#activity-${message.activity.id}`}
                          className="text-green-600 hover:text-green-900 inline-flex items-center"
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          View Activity
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}