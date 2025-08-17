import React, { useState } from 'react';
import { Bot, User, Copy, Check, Filter } from 'lucide-react';
import Spinner from './Spinner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessageProps {
  role: 'user' | 'model';
  content: string;
  onDeepDive?: (params: URLSearchParams) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ role, content, onDeepDive }) => {
  const isModel = role === 'model';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(content).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
      });
    }
  };

  if (content === 'GENERATING_SUMMARY') {
    return (
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
          <Bot size={20} />
        </div>
        <div className="bg-background/50 rounded-lg p-3 text-sm text-foreground/90 flex items-center gap-2">
          <Spinner size="sm" />
          <span>Generating initial insights...</span>
        </div>
      </div>
    );
  }

  if (isModel) {
    return (
      <div className="group flex items-start gap-3 w-full">
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
          <Bot size={20} />
        </div>
        <div className="relative bg-background/50 rounded-lg p-4 text-sm text-foreground/90 flex-1">
          <div className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
                ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
                strong: ({ node, ...props }) => <strong className="font-bold text-foreground" {...props} />,
                a: ({node, href, ...props}) => {
                  if (href && href.startsWith('ai-action://') && onDeepDive) {
                    try {
                      const url = new URL(href);
                      const params = url.searchParams;
                      return (
                        <button
                          className="text-primary font-medium hover:underline inline-flex items-center gap-1.5 px-2 py-1 bg-primary/10 hover:bg-primary/20 rounded-md transition-colors"
                          onClick={() => onDeepDive(params)}
                        >
                          <Filter className="h-3 w-3" />
                          <span>{props.children}</span>
                        </button>
                      );
                    } catch (e) {
                      console.error("Invalid AI action link:", href, e);
                      // Fallback to text for invalid links
                      return <span>{props.children}</span>;
                    }
                  }
                  // Render normal links
                  return <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" {...props} />;
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-1 rounded-md bg-secondary text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            aria-label="Copy message"
          >
            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 justify-end">
      <div className="bg-primary rounded-lg p-3 text-sm text-primary-foreground">
        {content}
      </div>
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground">
        <User size={20} />
      </div>
    </div>
  );
};

export default ChatMessage;