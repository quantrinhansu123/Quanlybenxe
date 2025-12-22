import { useEffect, useRef } from 'react'
import { MessageCircle, X, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useChatStore } from '../store/chatStore'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'

export function ChatWidget() {
  const {
    isOpen,
    messages,
    isLoading,
    toggleChat,
    sendMessage,
    clearChat
  } = useChatStore()

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        toggleChat()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, toggleChat])

  return (
    <>
      {/* Chat Window - z-[9999] to appear above all dialogs */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 w-96 h-[500px] bg-white rounded-lg shadow-2xl flex flex-col z-[9999] border overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b bg-blue-500 text-white">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              <span className="font-semibold">Trợ lý bến xe</span>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => clearChat()}
                className="hover:bg-blue-600 text-white h-8 w-8"
                title="Xóa lịch sử chat"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleChat}
                className="hover:bg-blue-600 text-white h-8 w-8"
                title="Đóng (Esc)"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-gray-50">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm p-4 text-center">
                <MessageCircle className="w-12 h-12 mb-4 text-gray-300" />
                <p className="font-medium mb-2">Xin chào! Tôi là trợ lý bến xe.</p>
                <p className="text-xs text-gray-400">
                  Hãy hỏi tôi về xe, tài xế, tuyến đường, phù hiệu...
                </p>
                <div className="mt-4 text-left text-xs bg-white p-3 rounded-lg border w-full">
                  <p className="font-medium mb-2 text-gray-600">Gợi ý:</p>
                  <ul className="space-y-1 text-gray-500">
                    <li>• "xe 98H07480"</li>
                    <li>• "đơn vị Phương Trang"</li>
                    <li>• "thống kê điều độ"</li>
                    <li>• "tuyến TP.HCM - Đà Lạt"</li>
                  </ul>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                {isLoading && (
                  <div className="flex gap-3 p-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                    </div>
                    <div className="bg-gray-100 rounded-lg p-3 text-sm text-gray-500">
                      Đang xử lý...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <ChatInput onSend={sendMessage} disabled={isLoading} />
        </div>
      )}

      {/* Toggle Button - z-[9999] to appear above all dialogs */}
      <Button
        onClick={toggleChat}
        className="fixed bottom-4 right-4 w-14 h-14 rounded-full shadow-lg z-[9999] bg-blue-500 hover:bg-blue-600"
        size="icon"
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </Button>
    </>
  )
}
