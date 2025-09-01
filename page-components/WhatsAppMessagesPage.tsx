'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { MessageSquare, User, Clock, CheckCircle, AlertCircle, ExternalLink, Plus, X, MapPin, Tag, Search, Filter } from 'lucide-react';
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
  onNavigateToDashboard?: (activityId: string) => void;
}

export default function WhatsAppMessagesPage({ onConvertToActivity, onNavigateToDashboard }: WhatsAppMessagesPageProps) {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'processed' | 'unprocessed' | 'with-activity'>('all');
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

  const parseMessageContent = (content: string) => {
    try {
      const parsed = JSON.parse(content);
      if (parsed.text) return parsed.text;
      if (typeof parsed === 'string') return parsed;
      return content;
    } catch {
      return content;
    }
  };

  // Filter and search functionality
  const filteredMessages = useMemo(() => {
    let filtered = messages;

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(message => {
        switch (filterStatus) {
          case 'processed':
            return message.processed;
          case 'unprocessed':
            return !message.processed && !message.activity;
          case 'with-activity':
            return !!message.activity;
          default:
            return true;
        }
      });
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(message => {
        const content = parseMessageContent(message.content).toLowerCase();
        const senderName = message.sender.name.toLowerCase();
        const senderPhone = message.sender.phone.toLowerCase();
        
        return content.includes(searchLower) || 
               senderName.includes(searchLower) || 
               senderPhone.includes(searchLower);
      });
    }

    return filtered;
  }, [messages, filterStatus, searchTerm]);

  const viewActivity = (activityId: string) => {
    if (onNavigateToDashboard) {
      onNavigateToDashboard(activityId);
    } else {
      addToast('Navigation Error', 'Unable to navigate to dashboard', 'error');
    }
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
      {/* Header Section - Matching Dashboard Style */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <MessageSquare className="w-7 h-7 mr-3 text-blue-600" />
              WhatsApp Messages
            </h1>
            <p className="text-gray-600 mt-1">
              Monitor and manage incoming WhatsApp messages • {messages.length} total
            </p>
          </div>
          <button
            onClick={fetchMessages}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
          >
            <Clock className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>

        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mt-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search messages, sender name, or phone number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="w-full sm:w-48">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Messages</option>
              <option value="with-activity">With Activity</option>
              <option value="processed">Processed</option>
              <option value="unprocessed">Unprocessed</option>
            </select>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center">
              <MessageSquare className="w-5 h-5 text-blue-500 mr-2" />
              <div>
                <p className="text-sm text-gray-600">Total Messages</p>
                <p className="text-lg font-semibold text-gray-900">{messages.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
              <div>
                <p className="text-sm text-gray-600">With Activities</p>
                <p className="text-lg font-semibold text-gray-900">
                  {messages.filter(m => m.activity).length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-orange-500 mr-2" />
              <div>
                <p className="text-sm text-gray-600">Unprocessed</p>
                <p className="text-lg font-semibold text-gray-900">
                  {messages.filter(m => !m.processed && !m.activity).length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center">
              <Filter className="w-5 h-5 text-blue-500 mr-2" />
              <div>
                <p className="text-sm text-gray-600">Showing</p>
                <p className="text-lg font-semibold text-gray-900">{filteredMessages.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {filteredMessages.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="text-center py-12">
            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">
              {messages.length === 0 ? 'No Messages Yet' : 'No Messages Match Your Filter'}
            </h3>
            <p className="text-gray-600 mt-2">
              {messages.length === 0 
                ? 'WhatsApp messages will appear here when received'
                : 'Try adjusting your search terms or filter options'
              }
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="mt-4 px-4 py-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Clear Search
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMessages.map((message) => (
            <div key={message.id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  {/* Sender Info */}
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <User className="w-8 h-8 text-gray-400 bg-gray-100 rounded-full p-1.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {message.sender.name}
                        </h3>
                        {message.sender.linkedUser && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {message.sender.linkedUser.role}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        {message.sender.phone}
                      </p>
                      
                      {/* Message Content */}
                      <div className="flex items-start space-x-2 mb-3">
                        <span className="text-lg flex-shrink-0 mt-0.5">
                          {getMessageTypeIcon(message.type)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm text-gray-900 break-words">
                            {parseMessageContent(message.content)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {message.type} • {message.direction} • {formatTimestamp(message.timestamp)}
                          </p>
                        </div>
                      </div>

                      {/* Activity Link */}
                      {message.activity && (
                        <div className="flex items-center space-x-2 text-xs text-gray-500 bg-green-50 rounded px-2 py-1 mb-3">
                          <Tag className="w-3 h-3" />
                          <span>Activity: {message.activity.location}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status and Actions */}
                  <div className="flex items-start space-x-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(message.processed, !!message.activity)}`}>
                      {getStatusText(message.processed, !!message.activity)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end space-x-2 mt-4 pt-4 border-t border-gray-100">
                  {!message.processed && !message.activity && (
                    <>
                      <button
                        onClick={() => onConvertToActivity?.(message)}
                        className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-xs font-medium rounded text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Convert to Activity
                      </button>
                      <button
                        onClick={() => markAsProcessed(message.id)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Mark Processed
                      </button>
                    </>
                  )}
                  {message.activity && (
                    <button
                      onClick={() => viewActivity(message.activity!.id)}
                      className="inline-flex items-center px-3 py-1.5 border border-green-300 text-xs font-medium rounded text-green-700 bg-green-50 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      View Activity
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}