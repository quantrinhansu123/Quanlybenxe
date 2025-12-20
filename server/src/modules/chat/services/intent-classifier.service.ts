import type { IntentResult, QueryType } from '../types/chat.types.js'

interface PatternConfig {
  type: QueryType
  patterns: RegExp[]
  paramExtractor: (match: RegExpMatchArray) => Record<string, string>
}

const INTENT_PATTERNS: PatternConfig[] = [
  {
    type: 'VEHICLE_LOOKUP',
    patterns: [
      // Direct plate number patterns (most specific first)
      /([0-9]{2}[A-Z][0-9]{4,5})/i,  // 98H07480, 51B12345
      /([0-9]{2}[A-Z]\-?[0-9]{3,5})/i,  // 98H-07480
      /([0-9]{2}[A-Z][0-9]+\.[0-9]+)/i,  // 98H07.480
      // With keywords
      /(?:xe|tim xe|tra cuu xe|thong tin xe|xem xe)\s+([A-Z0-9\-\.]+)/i,
      /(?:bien|bien so|bks|bien kiem soat)\s*(?:xe|so)?\s*([A-Z0-9\-\.]+)/i,
      // List all queries
      /^(?:bien\s*so\s*xe?|danh\s*sach\s*xe|tat\s*ca\s*xe|liet\s*ke\s*xe|ds\s*xe|list\s*xe)$/i,
      /^(?:co bao nhieu|so luong|tong so)\s*xe/i,
      /^xe$/i,  // Just "xe"
    ],
    paramExtractor: (match) => {
      const input = match[0].toLowerCase()
      // Check if it's a "list all" query
      if (/^(?:bien\s*so\s*xe?|danh\s*sach\s*xe|tat\s*ca\s*xe|liet\s*ke\s*xe|ds\s*xe|list\s*xe|xe)$/i.test(input) ||
          /^(?:co bao nhieu|so luong|tong so)\s*xe/i.test(input)) {
        return { plateNumber: '', listAll: 'true' }
      }
      // Extract plate number
      const plateMatch = match[1] || match[0].match(/[0-9]{2}[A-Z][0-9\-\.]+/i)?.[0]
      return { plateNumber: plateMatch?.toUpperCase().trim() || '', listAll: '' }
    }
  },
  {
    type: 'DRIVER_SEARCH',
    patterns: [
      /(?:tai\s*xe|lai\s*xe|tim tai xe|tra cuu tai xe|thong tin tai xe)\s+(.+?)(?:\s*$|\s+(?:cua|o|tai))/i,
      /(?:gplx|giay phep lai xe)\s*(?:so)?\s*([A-Z0-9]+)/i,
      /^(?:danh\s*sach\s*tai\s*xe|ds\s*tai\s*xe|tat\s*ca\s*tai\s*xe)$/i,
      /^tai\s*xe$/i,
    ],
    paramExtractor: (match) => {
      const input = match[0].toLowerCase()
      if (/^(?:danh\s*sach\s*tai\s*xe|ds\s*tai\s*xe|tat\s*ca\s*tai\s*xe|tai\s*xe)$/i.test(input)) {
        return { searchTerm: '', listAll: 'true' }
      }
      return { searchTerm: match[1]?.trim() || '', listAll: '' }
    }
  },
  {
    type: 'ROUTE_INFO',
    patterns: [
      /(?:tuyen|tuyen duong|thong tin tuyen)\s+(.+?)(?:\s*$|\s+(?:co|di|tu))/i,
      /(?:ma\s*tuyen|ma so tuyen)\s*([A-Z0-9\.\-]+)/i,
      /tuyen\s+(.+?)\s*[-–]\s*(.+?)(?:\s*$)/i,
      /^(?:danh\s*sach\s*tuyen|ds\s*tuyen|tat\s*ca\s*tuyen)$/i,
      /^tuyen$/i,
    ],
    paramExtractor: (match) => {
      const input = match[0].toLowerCase()
      if (/^(?:danh\s*sach\s*tuyen|ds\s*tuyen|tat\s*ca\s*tuyen|tuyen)$/i.test(input)) {
        return { searchTerm: '', destination: '', listAll: 'true' }
      }
      return {
        searchTerm: match[1]?.trim() || '',
        destination: match[2]?.trim() || '',
        listAll: ''
      }
    }
  },
  {
    type: 'SCHEDULE_QUERY',
    patterns: [
      /(?:lich|lich trinh|bieu do|gio chay)\s*(?:xe)?\s*(.+)?/i,
      /(?:chuyen|chuyen xe)\s+(\d{1,2}:\d{2})/i,
      /(?:xe|chuyen)\s+(?:luc|vao)\s+(\d{1,2}:\d{2})/i,
      /^(?:lich trinh|lich|bieu do)$/i,
    ],
    paramExtractor: (match) => ({ searchTerm: match[1]?.trim() || 'today' })
  },
  {
    type: 'DISPATCH_STATS',
    patterns: [
      /(?:thong ke|bao cao)\s*(?:dieu do|xe vao|xe ra)/i,
      /(?:xe vao ben|xe ra ben)\s*(?:hom nay|ngay)?/i,
      /(?:so luong|bao nhieu)\s*xe\s*(?:da|vao|ra)/i,
      /^(?:dieu do|thong ke|bao cao)$/i,
    ],
    paramExtractor: () => ({ period: 'today' })
  },
  {
    type: 'BADGE_LOOKUP',
    patterns: [
      /(?:phu\s*hieu|phu hieu xe)\s*(?:so)?\s*([A-Z0-9\-]+)/i,
      /(?:tra cuu|tim)\s*phu\s*hieu\s+(.+)/i,
      /^(?:danh\s*sach\s*phu\s*hieu|ds\s*phu\s*hieu|tat\s*ca\s*phu\s*hieu)$/i,
      /^phu\s*hieu$/i,
    ],
    paramExtractor: (match) => {
      const input = match[0].toLowerCase()
      if (/^(?:danh\s*sach\s*phu\s*hieu|ds\s*phu\s*hieu|tat\s*ca\s*phu\s*hieu|phu\s*hieu)$/i.test(input)) {
        return { badgeNumber: '', listAll: 'true' }
      }
      return { badgeNumber: match[1]?.trim() || '', listAll: '' }
    }
  },
  {
    type: 'OPERATOR_INFO',
    patterns: [
      /(?:don vi|don vi van tai|nha xe|cong ty)\s+(.+?)(?:\s*$|\s+(?:co|o))/i,
      /(?:thong tin|tra cuu)\s*(?:don vi|nha xe)\s+(.+)/i,
      /^(?:danh\s*sach\s*don\s*vi|ds\s*don\s*vi|tat\s*ca\s*don\s*vi|danh\s*sach\s*nha\s*xe)$/i,
      /^(?:don\s*vi|nha\s*xe)$/i,
    ],
    paramExtractor: (match) => {
      const input = match[0].toLowerCase()
      if (/^(?:danh\s*sach\s*don\s*vi|ds\s*don\s*vi|tat\s*ca\s*don\s*vi|danh\s*sach\s*nha\s*xe|don\s*vi|nha\s*xe)$/i.test(input)) {
        return { searchTerm: '', listAll: 'true' }
      }
      return { searchTerm: match[1]?.trim() || '', listAll: '' }
    }
  },
]

export class IntentClassifierService {
  classify(message: string): IntentResult {
    const normalizedMessage = this.normalizeMessage(message)

    for (const config of INTENT_PATTERNS) {
      for (const pattern of config.patterns) {
        const match = normalizedMessage.match(pattern)
        if (match) {
          return {
            type: config.type,
            confidence: this.calculateConfidence(match, pattern),
            extractedParams: config.paramExtractor(match)
          }
        }
      }
    }

    return {
      type: 'GENERAL_QUESTION',
      confidence: 1.0,
      extractedParams: {}
    }
  }

  private normalizeMessage(message: string): string {
    return message
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^\w\s\-\.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private calculateConfidence(match: RegExpMatchArray, _pattern: RegExp): number {
    const matchLength = match[0].length
    const fullLength = match.input?.length || matchLength
    const ratio = matchLength / fullLength

    if (ratio > 0.8) return 0.95
    if (ratio > 0.5) return 0.85
    if (ratio > 0.3) return 0.75
    return 0.65
  }
}

export const intentClassifier = new IntentClassifierService()
