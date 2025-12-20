import { Request, Response } from 'express'
import { intentClassifier } from './services/intent-classifier.service.js'
import { dataQueryService } from './services/data-query.service.js'
import { responseFormatter } from './services/response-formatter.service.js'
import { aiService } from './services/ai.service.js'
import type { ChatRequest, ChatResponse } from './types/chat.types.js'

const generateSessionId = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export const processMessage = async (req: Request, res: Response): Promise<void> => {
  const { message, sessionId: inputSessionId } = req.body as ChatRequest
  const startTime = Date.now()
  const sessionId = inputSessionId || generateSessionId()

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({
      response: 'Vui lòng nhập tin nhắn',
      type: 'error',
      sessionId
    } as ChatResponse)
    return
  }

  if (message.length > 1000) {
    res.status(400).json({
      response: 'Tin nhắn quá dài (tối đa 1000 ký tự)',
      type: 'error',
      sessionId
    } as ChatResponse)
    return
  }

  try {
    // 1. Classify intent
    const intent = intentClassifier.classify(message.trim())

    // 2. If data query type with high confidence, query database
    if (intent.type !== 'GENERAL_QUESTION' && intent.confidence >= 0.65) {
      const result = await dataQueryService.execute(intent)

      if (result.success && result.data) {
        const response = responseFormatter.format(intent.type, result)
        const processingTime = Date.now() - startTime

        res.json({
          response,
          type: 'data',
          sessionId,
          metadata: {
            queryType: intent.type,
            processingTime,
            resultCount: Array.isArray(result.data) ? result.data.length : 1
          }
        } as ChatResponse)
        return
      }

      // Data query failed, but we have a specific intent
      // Return the error message
      if (result.error) {
        res.json({
          response: result.error,
          type: 'data',
          sessionId,
          metadata: {
            queryType: intent.type,
            processingTime: Date.now() - startTime,
            resultCount: 0
          }
        } as ChatResponse)
        return
      }
    }

    // 3. AI processing for general questions
    // Get context from database to help AI
    const dataContext = await dataQueryService.getContextForAI(message)
    
    // Check if AI is available
    if (!aiService.hasApiKey()) {
      res.json({
        response: 'Xin lỗi, hệ thống AI chưa được cấu hình. Vui lòng thử các câu hỏi tra cứu như:\n\n' +
          '• "xe 98H07480" - Tra cứu thông tin xe\n' +
          '• "tài xế Nguyễn Văn A" - Tìm tài xế\n' +
          '• "tuyến TP.HCM - Đà Lạt" - Thông tin tuyến\n' +
          '• "đơn vị Phương Trang" - Thông tin đơn vị vận tải\n' +
          '• "thống kê điều độ" - Thống kê xe vào/ra bến',
        type: 'ai',
        sessionId,
        metadata: {
          queryType: 'GENERAL_QUESTION',
          processingTime: Date.now() - startTime,
          hasContext: false
        }
      } as ChatResponse)
      return
    }

    // Generate AI response
    const aiResponse = await aiService.generateResponse(
      message.trim(),
      sessionId,
      dataContext
    )

    res.json({
      response: aiResponse,
      type: 'ai',
      sessionId,
      metadata: {
        queryType: 'GENERAL_QUESTION',
        processingTime: Date.now() - startTime,
        hasContext: Object.keys(dataContext).length > 0
      }
    } as ChatResponse)
  } catch (error: any) {
    console.error('Chat error:', error)
    res.status(500).json({
      response: 'Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại sau.',
      type: 'error',
      sessionId,
      metadata: {
        processingTime: Date.now() - startTime
      }
    } as ChatResponse)
  }
}

export const clearHistory = async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params

  if (!sessionId) {
    res.status(400).json({ success: false, error: 'Session ID is required' })
    return
  }

  // Clear AI conversation history
  aiService.clearHistory(sessionId)
  res.json({ success: true })
}
