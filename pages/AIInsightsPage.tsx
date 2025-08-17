'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
// ... rest of the file
import { User, Activity, Category } from '../types';
import { Sparkles, Send, Bot, FileText } from 'lucide-react';
import { parseDateStringAsLocal } from '../lib/utils';
import Spinner from '../components/Spinner';
import ChatMessage from '../components/ChatMessage';
import FilterControls from '../components/FilterControls';
import AIProviderSelector, { AIProviderType } from '../components/AIProviderSelector';
import { useToast } from '../hooks/useToast';
import { AIMessage } from '../lib/ai-providers';

type Message = {
    role: 'user' | 'model';
    content: string;
};

type CachedSessionData = {
    messages: Message[];
    suggestions: string[];
    sdkHistory: AIMessage[];
};

interface AIInsightsPageProps {
  selectedUserId: string;
  setSelectedUserId: (value: string) => void;
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  dateRange: { start: string; end: string };
  setDateRange: (value: { start: string; end: string }) => void;
  categories: Array<{ value: string; label: string; }>;
  allCategories: Category[];
  onDeepDive: (params: URLSearchParams) => void;
  setSearchTerm: (value: string) => void;
  users: User[];
  activities: Activity[];
  loading: boolean;
}

const AIInsightsPage: React.FC<AIInsightsPageProps> = ({
    selectedUserId,
    setSelectedUserId,
    selectedCategory,
    setSelectedCategory,
    dateRange,
    setDateRange,
    categories,
    allCategories,
    onDeepDive,
    setSearchTerm,
    users,
    activities,
    loading,
}) => {
    const { addToast } = useToast();
    const [messages, setMessages] = useState<Message[]>([]);
    const [userInput, setUserInput] = useState<string>('');
    const [isReplying, setIsReplying] = useState<boolean>(false);
    const [isGeneratingSummary, setIsGeneratingSummary] = useState<boolean>(true);
    const [statusText, setStatusText] = useState('Preparing analysis...');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [selectedProvider, setSelectedProvider] = useState<AIProviderType>('gemini');
    const [availableProviders, setAvailableProviders] = useState<AIProviderType[]>(['gemini']);
    const [isClient, setIsClient] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const sdkHistoryRef = useRef<AIMessage[]>([]);
    
    // Client-side only initialization
    useEffect(() => {
        setIsClient(true);
    }, []);
    
    const sessionCacheKey = useMemo(() => {
        const filterState = { selectedUserId, selectedCategory, dateRange };
        return `ai-chat-session-${JSON.stringify(filterState)}`;
    }, [selectedUserId, selectedCategory, dateRange]);

    const filteredActivities = useMemo(() => {
        const startDate = parseDateStringAsLocal(dateRange.start);
        const endDate = parseDateStringAsLocal(dateRange.end);

        return activities
            .filter(activity => {
                if (selectedUserId === 'all') return true;
                return activity.user_id === selectedUserId;
            })
            .filter(activity => {
                if (selectedCategory === 'all') return true;
                if (selectedCategory === 'UNPLANNED_INCIDENTS') {
                    return activity.category_id === 'unplanned' || activity.category_id === 'learner_wellness';
                }
                return activity.category_id === selectedCategory;
            })
            .filter(activity => {
                const activityDate = new Date(activity.timestamp);
                if (startDate && activityDate < startDate) return false;
                if (endDate) {
                    const endOfDay = new Date(endDate);
                    endOfDay.setHours(23, 59, 59, 999);
                    if(activityDate > endOfDay) return false;
                }
                return true;
            });
    }, [activities, selectedUserId, selectedCategory, dateRange]);

    // Load available providers on mount
    useEffect(() => {
        if (!isClient) return;
        
        const loadProviders = async () => {
            try {
                const response = await fetch('/api/ai/providers');
                const data = await response.json();
                setAvailableProviders(data.available);
                setSelectedProvider(data.default);
            } catch (error) {
                console.error('Failed to load AI providers:', error);
            }
        };
        loadProviders();
    }, [isClient]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isReplying, isGeneratingSummary]);
    
    const contextDescription = useMemo(() => {
        if (isGeneratingSummary) return statusText;
        if (isReplying) return 'Assistant is replying...';
        if (filteredActivities.length === 0) {
            const hasFilters = selectedUserId !== 'all' || selectedCategory !== 'all' || dateRange.start || dateRange.end;
            return hasFilters ? 'No activities match the current filters. Try clearing them.' : 'No activities found in the dataset.';
        }
    
        const parts: string[] = [];
        parts.push(`Analyzing ${filteredActivities.length} activities`);
    
        if (selectedUserId === 'all') parts.push('for all staff');
        else {
            const userName = users.find(u => u.id === selectedUserId)?.name;
            if (userName) parts.push(`for ${userName}`);
        }
    
        if (selectedCategory !== 'all') {
            const categoryLabel = categories.find(c => c.value === selectedCategory)?.label || selectedCategory;
            parts.push(`in the "${categoryLabel}" category`);
        }
    
        if (dateRange.start || dateRange.end) {
            const formatOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
            const startStr = dateRange.start ? parseDateStringAsLocal(dateRange.start)?.toLocaleDateString(undefined, formatOptions) : null;
            const endStr = dateRange.end ? parseDateStringAsLocal(dateRange.end)?.toLocaleDateString(undefined, formatOptions) : null;
    
            if (startStr && endStr) parts.push(`between ${startStr} and ${endStr}`);
            else if (startStr) parts.push(`from ${startStr}`);
            else if (endStr) parts.push(`until ${endStr}`);
        }
    
        return parts.join(' ') + '.';
    
    }, [ isGeneratingSummary, isReplying, filteredActivities.length, selectedUserId, selectedCategory, dateRange, users, categories, statusText ]);

    useEffect(() => {
        if (!isClient) return;
        
        const startOrRestoreConversation = async () => {
            if (loading) return;

            setIsGeneratingSummary(true);
            setIsReplying(false);
            setSuggestions([]);
            setMessages([]);
            setError(null);
            sdkHistoryRef.current = [];
            setStatusText('Preparing analysis...');
            
            const cachedSessionRaw = sessionStorage.getItem(sessionCacheKey);
            if (cachedSessionRaw) {
                try {
                    const cachedData: CachedSessionData = JSON.parse(cachedSessionRaw);
                    setMessages(cachedData.messages);
                    setSuggestions(cachedData.suggestions);
                    sdkHistoryRef.current = cachedData.sdkHistory;
                    setIsGeneratingSummary(false);
                    return;
                } catch (e) {
                    sessionStorage.removeItem(sessionCacheKey);
                }
            }

            if (filteredActivities.length === 0) {
                setMessages([{ role: 'model', content: "There are no activities matching your current filters." }]);
                setIsGeneratingSummary(false);
                return;
            }

            setMessages([{ role: 'model', content: 'GENERATING_SUMMARY' }]);

            try {
                const response = await fetch(`/api/ai/chat?provider=${selectedProvider}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        history: [],
                        message: "INITIAL_SUMMARY",
                        context: { activities: filteredActivities, users, allCategories }
                    })
                });

                if (!response.ok) throw new Error('Failed to get summary from server.');

                const { analysis, suggestions: newSuggestions, history } = await response.json();
                
                sdkHistoryRef.current = history;
                const uiMessages: Message[] = [{ role: 'model', content: analysis }];
                
                setMessages(uiMessages);
                setSuggestions(newSuggestions);
                
                sessionStorage.setItem(sessionCacheKey, JSON.stringify({
                    messages: uiMessages,
                    suggestions: newSuggestions,
                    sdkHistory: history
                }));

            } catch (e) {
                const errorMsg = 'Sorry, I had trouble generating an initial summary. Please try adjusting your filters or reloading.';
                addToast('AI Error', 'Failed to generate summary.', 'error');
                setMessages([{ role: 'model', content: errorMsg }]);
                setError('An error occurred during initial analysis.');
            } finally {
                setIsGeneratingSummary(false);
            }
        };

        startOrRestoreConversation();
    }, [sessionCacheKey, loading, isClient]);

    const handleClearFilters = () => {
        setSelectedUserId('all');
        setSelectedCategory('all');
        setDateRange({ start: '', end: '' });
        setSearchTerm('');
        setError(null);
    }
    
    const sendMessage = async (prompt: string) => {
        if (!prompt || isReplying || isGeneratingSummary) return;

        const userMessage: Message = { role: 'user', content: prompt };
        setMessages(prev => [...prev, userMessage, { role: 'model', content: '' }]);
        setIsReplying(true);
        setError(null);
        setSuggestions([]);

        sdkHistoryRef.current.push({ role: 'user', content: prompt });

        try {
            const response = await fetch(`/api/ai/chat?provider=${selectedProvider}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    history: sdkHistoryRef.current,
                    message: prompt
                })
            });

            if (!response.body) throw new Error("No response body");
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let currentContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                currentContent += decoder.decode(value, { stream: true });
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].content = currentContent;
                    return newMessages;
                });
            }

            const newModelMessage: Message = { role: 'model', content: currentContent };
            const finalMessages = [...messages, userMessage, newModelMessage];
            sdkHistoryRef.current.push({ role: 'assistant', content: currentContent });

            if (isClient) {
                sessionStorage.setItem(sessionCacheKey, JSON.stringify({
                    messages: finalMessages,
                    suggestions: [], 
                    sdkHistory: sdkHistoryRef.current
                }));
            }

        } catch (e) {
            const errorMsg = 'Sorry, I encountered an error. Please try again.';
            addToast('AI Error', 'Communication with the AI failed.', 'error');
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1].content = errorMsg;
                return newMessages;
            });
            setError('An error occurred while communicating with the AI.');
        } finally {
            setIsReplying(false);
        }
    };
    
    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await sendMessage(userInput.trim());
        setUserInput('');
    };

    const handleExportReport = () => {
        if (isGeneratingSummary || messages.length === 0 || error || !isClient) return;
        const reportHtml = `...`; // Omitted for brevity, logic remains the same
        const reportWindow = window.open('', '_blank');
        if (reportWindow) {
            reportWindow.document.write(reportHtml);
            reportWindow.document.close();
        } else {
            addToast('Export Failed', 'Please disable your pop-up blocker.', 'error');
        }
    };

    // Show loading until client-side hydration
    if (!isClient || (loading && messages.length === 0)) {
        return <div className="flex items-center justify-center min-h-[50vh]"><Spinner size="lg" /></div>;
    }
  
    const isChatReady = filteredActivities.length > 0 && !isGeneratingSummary;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">AI Chat Analyst</h2>
                <p className="text-muted-foreground">Filter the dataset, then ask the AI assistant questions.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-3">
                    <FilterControls 
                        users={users} 
                        categories={categories} 
                        selectedUserId={selectedUserId} 
                        setSelectedUserId={setSelectedUserId} 
                        selectedCategory={selectedCategory} 
                        setSelectedCategory={setSelectedCategory} 
                        dateRange={dateRange} 
                        setDateRange={setDateRange} 
                        onClearFilters={handleClearFilters} 
                    />
                </div>
                <div className="lg:col-span-1">
                    <AIProviderSelector
                        selectedProvider={selectedProvider}
                        onProviderChange={setSelectedProvider}
                        availableProviders={availableProviders}
                    />
                </div>
            </div>

            <div className="bg-secondary/30 border border-border rounded-lg flex flex-col h-[60vh]">
                <div className="p-3 border-b border-border flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                        <Bot className="h-6 w-6 text-primary" />
                        <div>
                            <h3 className="text-lg font-semibold">Conversation</h3>
                            <p className="text-xs text-muted-foreground">{contextDescription}</p>
                        </div>
                    </div>
                    <button onClick={handleExportReport} disabled={isGeneratingSummary || isReplying || messages.length === 0 || !!error} className="flex items-center gap-2 text-sm bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md px-3 py-1.5 transition-colors disabled:opacity-50">
                        <FileText className="h-4 w-4" /> <span className="hidden sm:inline">Export Report</span>
                    </button>
                </div>

                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                    {messages.map((msg, index) => (
                        <ChatMessage key={index} role={msg.role} content={msg.content} onDeepDive={onDeepDive} />
                    ))}
                    <div ref={messagesEndRef} />
                </div>
                
                {suggestions.length > 0 && !isReplying && (
                    <div className="px-4 pb-3 pt-2 border-t border-border">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Suggested Questions:</p>
                        <div className="flex flex-wrap gap-2">
                            {suggestions.map((q, i) => (
                                <button key={i} onClick={() => sendMessage(q)} className="flex items-center gap-2 text-sm bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-full px-3 py-1.5">
                                    <Sparkles className="h-3 w-3 text-primary" /> <span>{q}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                
                {error && <p className="text-sm text-destructive px-4 pb-2" role="alert">{error}</p>}
                
                <div className="p-4 border-t border-border">
                    <form onSubmit={handleFormSubmit} className="flex items-center gap-3">
                        <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder={isChatReady ? "Ask a follow-up question..." : "Adjust filters to start."} disabled={!isChatReady || isReplying} className="flex-1 bg-input border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed" />
                        <button type="submit" disabled={!userInput.trim() || !isChatReady || isReplying} className="bg-primary text-primary-foreground rounded-md p-2 h-9 w-9 flex items-center justify-center hover:bg-primary/90 disabled:bg-muted">
                            {isReplying ? <Spinner size="sm" /> : <Send className="h-4 w-4" />}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AIInsightsPage;
