import { cn } from '@/lib/utils'
import type { ChatMessage as ChatMessageType } from '../types'
import { Bot, User } from 'lucide-react'

interface ChatMessageProps {
  message: ChatMessageType
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn(
      'flex gap-3 p-3',
      isUser ? 'flex-row-reverse' : ''
    )}>
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
        isUser ? 'bg-blue-500' : 'bg-gray-200'
      )}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-gray-600" />
        )}
      </div>
      <div className={cn(
        'max-w-[80%] rounded-lg p-3',
        isUser
          ? 'bg-blue-500 text-white'
          : 'bg-gray-100 text-gray-900',
        message.type === 'error' && 'bg-red-100 text-red-700'
      )}>
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content}
        </div>
        {message.metadata?.processingTime && (
          <div className={cn(
            'text-xs mt-2 opacity-70',
            isUser ? 'text-blue-100' : 'text-gray-500'
          )}>
            {message.metadata.processingTime}ms
            {message.metadata.queryType && message.metadata.queryType !== 'GENERAL_QUESTION' && (
              <span className="ml-2">• {message.metadata.queryType}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
