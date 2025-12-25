import { GoogleGenerativeAI, Content, FunctionCallingMode } from '@google/generative-ai'
import { CHAT_FUNCTIONS, executeFunction } from './chat-functions.js'
import { chatCacheService } from './chat-cache.service.js'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

const SYSTEM_PROMPT = `Bạn là trợ lý ảo thông minh của hệ thống quản lý bến xe khách.

**Vai trò:**
- Hỗ trợ người dùng tra cứu thông tin về xe, tài xế, tuyến đường, phù hiệu, dịch vụ
- Giải thích quy trình nghiệp vụ điều độ xe
- Trả lời câu hỏi về hệ thống quản lý bến xe

**Quy tắc quan trọng:**
- Trả lời bằng tiếng Việt, ngắn gọn và dễ hiểu
- LUÔN sử dụng function calling để truy vấn dữ liệu khi người dùng hỏi về thông tin cụ thể
- Khi có kết quả từ function call, hãy format thông tin một cách rõ ràng và thân thiện
- Nếu không tìm thấy dữ liệu, hãy gợi ý cách tìm kiếm khác
- KHÔNG BAO GIỜ nói "hệ thống bận" hay từ chối trả lời

**Hệ thống quản lý:**
- Quản lý xe khách, xe buýt tuyến cố định
- Điều độ xe vào/ra bến
- Quản lý tài xế, giấy phép lái xe
- Quản lý đơn vị vận tải
- Cấp phù hiệu xe
- Quản lý tuyến đường và lịch trình
- Quản lý dịch vụ, hóa đơn, vi phạm

**Ví dụ câu hỏi:**
- "xe 98H07480" → gọi search_vehicle
- "tài xế Nguyễn" → gọi search_driver
- "đơn vị Phương Trang" → gọi search_operator
- "tuyến Sài Gòn Đà Lạt" → gọi search_route
- "thống kê hôm nay" → gọi get_dispatch_stats
- "hệ thống có bao nhiêu xe" → gọi get_system_stats`

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
    sessionId: string
  ): Promise<string> {
    try {
      const genAI = this.getGenAI()

      // Get model with function calling enabled
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        tools: [{ functionDeclarations: CHAT_FUNCTIONS as any }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingMode.AUTO
          }
        },
        systemInstruction: SYSTEM_PROMPT
      })

      // Get conversation history
      let history = this.conversationHistory.get(sessionId) || []

      // Start chat with history
      const chat = model.startChat({
        history: history,
        generationConfig: {
          maxOutputTokens: 1500,
          temperature: 0.7,
        },
      })

      // Send message
      let result = await chat.sendMessage(message)
      let response = result.response

      // Check for function calls
      let functionCalls = response.functionCalls()
      let iterations = 0
      const maxIterations = 3

      while (functionCalls && functionCalls.length > 0 && iterations < maxIterations) {
        iterations++
        console.log(`[AI] Function call ${iterations}: ${functionCalls.map(fc => fc.name).join(', ')}`)

        // Execute all function calls
        const functionResponses = await Promise.all(
          functionCalls.map(async (fc) => {
            const result = await executeFunction(fc.name, fc.args as Record<string, any>)
            return {
              functionResponse: {
                name: fc.name,
                response: result
              }
            }
          })
        )

        // Send function results back to model
        result = await chat.sendMessage(functionResponses)
        response = result.response
        functionCalls = response.functionCalls()
      }

      const responseText = response.text()

      // Update history (keep last 20 messages = 10 exchanges)
      history = [...history, { role: 'user', parts: [{ text: message }] }, { role: 'model', parts: [{ text: responseText }] }]
      if (history.length > 20) {
        history = history.slice(-20)
      }
      this.conversationHistory.set(sessionId, history)

      return responseText
    } catch (error: any) {
      console.error('AI Service error:', error?.message || error)
      console.error('AI Service error stack:', error?.stack)
      console.error('AI Service error details:', JSON.stringify(error, null, 2))
      return this.getFallbackResponse(message, error)
    }
  }

  private async getFallbackResponse(message: string, _error?: any): Promise<string> {
    // Try to use cached data as fallback
    try {
      if (!chatCacheService.isReady()) {
        await chatCacheService.preWarm()
      }

      const results = chatCacheService.fuzzySearch(message)
      if (results.length > 0) {
        return this.formatFallbackResults(results)
      }
    } catch {
      // Ignore cache errors
    }

    // Return helpful guidance instead of error
    const stats = chatCacheService.isReady() ? chatCacheService.getSystemStats() : null
    const statsInfo = stats
      ? `\n\nHệ thống hiện có ${stats.vehicles} xe, ${stats.drivers} tài xế, ${stats.operators} đơn vị vận tải.`
      : ''

    return `Xin lỗi, tôi không thể tìm thấy thông tin bạn cần.

**Bạn có thể thử:**
• Tìm xe: "xe 98H07480" hoặc "biển số 51B12345"
• Tìm tài xế: "tài xế Nguyễn Văn A"
• Tìm đơn vị: "đơn vị Phương Trang"
• Tìm tuyến: "tuyến TP.HCM - Đà Lạt"
• Thống kê: "thống kê điều độ hôm nay"
• Tổng quan: "hệ thống có bao nhiêu xe"${statsInfo}`
  }

  private formatFallbackResults(results: any[]): string {
    let response = '**Kết quả tìm kiếm:**\n\n'

    const vehicles = results.filter(r => r._source === 'vehicles')
    const badges = results.filter(r => r._source === 'badges')
    const operators = results.filter(r => r._source === 'operators')
    const drivers = results.filter(r => r._source === 'drivers')
    const routes = results.filter(r => r._source === 'routes')

    if (vehicles.length > 0) {
      response += `**Xe (${vehicles.length}):**\n`
      vehicles.slice(0, 3).forEach(v => {
        const plate = v.plate_number || v.BienSo || 'N/A'
        const type = v.LoaiXe || v.vehicle_type || ''
        response += `• ${plate}${type ? ` - ${type}` : ''}\n`
      })
      response += '\n'
    }

    if (badges.length > 0) {
      response += `**Phù hiệu (${badges.length}):**\n`
      badges.slice(0, 3).forEach(b => {
        const plate = b.BienSoXe || b.plate_number || 'N/A'
        const badgeNum = b.SoPhuHieu || b.badge_number || ''
        response += `• ${plate}${badgeNum ? ` - PH: ${badgeNum}` : ''}\n`
      })
      response += '\n'
    }

    if (operators.length > 0) {
      response += `**Đơn vị (${operators.length}):**\n`
      operators.slice(0, 3).forEach(o => {
        const name = o.TenDonVi || o.name || 'N/A'
        response += `• ${name}\n`
      })
      response += '\n'
    }

    if (drivers.length > 0) {
      response += `**Tài xế (${drivers.length}):**\n`
      drivers.slice(0, 3).forEach(d => {
        const name = d.full_name || d.fullName || 'N/A'
        response += `• ${name}\n`
      })
      response += '\n'
    }

    if (routes.length > 0) {
      response += `**Tuyến (${routes.length}):**\n`
      routes.slice(0, 3).forEach(r => {
        const code = r.MaSoTuyen || r.route_code || ''
        const departure = r.BenDi || r.departure_station || ''
        const arrival = r.BenDen || r.arrival_station || ''
        response += `• ${code ? `[${code}] ` : ''}${departure} - ${arrival}\n`
      })
    }

    return response.trim()
  }

  clearHistory(sessionId: string): void {
    this.conversationHistory.delete(sessionId)
  }

  hasApiKey(): boolean {
    return !!GEMINI_API_KEY
  }
}

export const aiService = new AIService()
