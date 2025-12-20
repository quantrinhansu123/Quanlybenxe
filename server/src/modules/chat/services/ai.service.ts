import { GoogleGenerativeAI, Content } from '@google/generative-ai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

const SYSTEM_PROMPT = `Bạn là trợ lý ảo thông minh của hệ thống quản lý bến xe khách.

**Vai trò:**
- Hỗ trợ người dùng tra cứu thông tin về xe, tài xế, tuyến đường, phù hiệu
- Giải thích quy trình nghiệp vụ điều độ xe
- Trả lời câu hỏi về hệ thống quản lý bến xe

**Quy tắc:**
- Trả lời bằng tiếng Việt, ngắn gọn và dễ hiểu
- Nếu không biết chắc chắn, hãy nói rõ và đề xuất cách tìm hiểu
- Không bịa đặt thông tin về xe, tài xế, tuyến đường cụ thể
- Khi có dữ liệu được cung cấp, sử dụng để trả lời chính xác

**Hệ thống quản lý:**
- Quản lý xe khách, xe buýt tuyến cố định
- Điều độ xe vào/ra bến
- Quản lý tài xế, giấy phép lái xe
- Quản lý đơn vị vận tải
- Cấp phù hiệu xe
- Quản lý tuyến đường và lịch trình

**Gợi ý câu hỏi phổ biến:**
- "xe [biển số]" - Tra cứu thông tin xe
- "tài xế [tên]" - Tìm tài xế
- "tuyến [tên bến]" - Thông tin tuyến đường
- "thống kê điều độ" - Báo cáo xe vào/ra bến`

class AIService {
  private genAI: GoogleGenerativeAI | null = null
  private conversationHistory: Map<string, Content[]> = new Map()

  private getGenAI(): GoogleGenerativeAI {
    if (!this.genAI) {
      if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured')
      }
      this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
    }
    return this.genAI
  }

  async generateResponse(
    message: string,
    sessionId: string,
    dataContext?: any
  ): Promise<string> {
    try {
      const genAI = this.getGenAI()
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' })

      // Build prompt with context
      let prompt = message
      if (dataContext && Object.keys(dataContext).length > 0) {
        prompt = `Dữ liệu tham khảo từ hệ thống:
\`\`\`json
${JSON.stringify(dataContext, null, 2)}
\`\`\`

Câu hỏi của người dùng: ${message}

Hãy sử dụng dữ liệu trên (nếu liên quan) để trả lời câu hỏi.`
      }

      // Get or create conversation history
      let history = this.conversationHistory.get(sessionId) || []

      // Start chat with system prompt and history
      const chat = model.startChat({
        history: [
          {
            role: 'user',
            parts: [{ text: 'Bạn là ai và có thể giúp gì?' }]
          },
          {
            role: 'model',
            parts: [{ text: SYSTEM_PROMPT }]
          },
          ...history
        ],
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.7,
        },
      })

      // Send message and get response
      const result = await chat.sendMessage(prompt)
      const response = result.response.text()

      // Update history (keep last 20 messages = 10 exchanges)
      history.push(
        { role: 'user', parts: [{ text: prompt }] },
        { role: 'model', parts: [{ text: response }] }
      )
      if (history.length > 20) {
        history = history.slice(-20)
      }
      this.conversationHistory.set(sessionId, history)

      return response
    } catch (error: any) {
      console.error('AI Service error:', error)

      if (error.message?.includes('API key')) {
        return 'Xin lỗi, hệ thống AI chưa được cấu hình. Vui lòng liên hệ quản trị viên.'
      }

      if (error.message?.includes('quota') || error.message?.includes('rate')) {
        return 'Hệ thống đang bận, vui lòng thử lại sau ít phút.'
      }

      if (error.message?.includes('404') || error.message?.includes('not found')) {
        return 'Model AI đang được cập nhật. Vui lòng thử các câu hỏi tra cứu như: "xe 98H07480", "đơn vị Phương Trang"'
      }

      return 'Xin lỗi, không thể xử lý yêu cầu của bạn lúc này. Vui lòng thử lại sau.'
    }
  }

  clearHistory(sessionId: string): void {
    this.conversationHistory.delete(sessionId)
  }

  hasApiKey(): boolean {
    return !!GEMINI_API_KEY
  }
}

export const aiService = new AIService()
