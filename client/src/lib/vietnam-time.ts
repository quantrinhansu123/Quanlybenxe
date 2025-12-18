/**
 * Vietnam Timezone Utility Module
 * 
 * Centralized module for handling Vietnam timezone (UTC+7) conversions.
 * This module provides clean, type-safe utilities for:
 * - Parsing user input in Vietnam time format
 * - Formatting dates for display in Vietnam time
 * - Converting between UTC (database) and Vietnam time
 * 
 * @module vietnam-time
 */

import { format } from "date-fns"

/**
 * Vietnam timezone offset in hours (UTC+7)
 */
export const VIETNAM_TIMEZONE_OFFSET_HOURS = 7

/**
 * Vietnam timezone identifier
 */
export const VIETNAM_TIMEZONE = "Asia/Ho_Chi_Minh"

/**
 * Default date format used throughout the application
 */
export const DEFAULT_DATE_FORMAT = "HH:mm dd/MM/yyyy"

/**
 * Parse a date string in "HH:mm dd/MM/yyyy" format and convert to ISO string.
 * Treats the input as Vietnam time (UTC+7) and stores it as UTC+7 in database.
 * 
 * @param dateTimeString - Date string in format "HH:mm dd/MM/yyyy"
 * @returns ISO string with UTC+7 offset for database storage
 * 
 * @example
 * parseVietnamDateTime("14:30 25/12/2024")
 * // Returns: "2024-12-25T14:30:00+07:00" (Vietnam time stored as UTC+7)
 */
export function parseVietnamDateTime(dateTimeString: string): string {
  try {
    const parts = dateTimeString.trim().split(" ")
    if (parts.length < 2) {
      throw new Error("Invalid date format")
    }

    const timePart = parts[0]
    const datePart = parts.slice(1).join(" ")
    
    const [hours, minutes] = timePart.split(":").map(Number)
    const [day, month, year] = datePart.split("/").map(Number)

    if (
      isNaN(hours) || isNaN(minutes) ||
      isNaN(day) || isNaN(month) || isNaN(year) ||
      hours < 0 || hours >= 24 ||
      minutes < 0 || minutes >= 60 ||
      day < 1 || day > 31 ||
      month < 1 || month > 12 ||
      year < 1900
    ) {
      throw new Error("Invalid date/time values")
    }

    // Create ISO string with Vietnam timezone offset (+07:00)
    // This will be stored as-is in database, representing Vietnam time
    const isoString = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00+07:00`
    
    // Verify it's a valid date
    const dateObj = new Date(isoString)
    if (isNaN(dateObj.getTime())) {
      throw new Error("Invalid date")
    }

    // Return ISO string with +07:00 offset (representing Vietnam time)
    return isoString
  } catch (error) {
    console.error("Error parsing Vietnam date time:", error, dateTimeString)
    throw new Error(`Failed to parse date: ${dateTimeString}`)
  }
}

/**
 * Format date string from database for display.
 * Database stores time as UTC+7, so we format it directly.
 * 
 * @param dateString - ISO date string from database (can be with or without timezone)
 * @param formatString - Format string (default: "HH:mm dd/MM/yyyy")
 * @returns Formatted date string in Vietnam time, or "-" if invalid
 * 
 * @example
 * formatVietnamDateTime("2024-12-25T14:30:00+07:00")
 * // Returns: "14:30 25/12/2024"
 */
export function formatVietnamDateTime(
  dateString: string | undefined | null,
  formatString: string = DEFAULT_DATE_FORMAT
): string {
  if (!dateString) return "-"

  try {
    // Parse the date string
    // If it has timezone (+07:00), Date will interpret it correctly
    // If it doesn't have timezone, treat it as UTC+7
    let dateObj: Date
    
    if (dateString.includes('+07:00') || dateString.endsWith('+07:00')) {
      // Already has +07:00, parse directly
      dateObj = new Date(dateString)
    } else if (dateString.endsWith('Z')) {
      // Has Z (UTC), need to add 7 hours to get Vietnam time
      const utcDate = new Date(dateString)
      dateObj = new Date(utcDate.getTime() + VIETNAM_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000)
    } else {
      // No timezone info, treat as UTC+7 and add +07:00
      const dateWithTZ = dateString.endsWith('+07:00') ? dateString : `${dateString}+07:00`
      dateObj = new Date(dateWithTZ)
    }
    
    if (isNaN(dateObj.getTime())) {
      console.warn("Invalid date string:", dateString)
      return "-"
    }

    // Get components - if dateString had +07:00, these are Vietnam time
    // If it had Z, we already added 7 hours
    const vnYear = dateObj.getFullYear()
    const vnMonth = dateObj.getMonth() // 0-11
    const vnDay = dateObj.getDate()
    const vnHours = dateObj.getHours()
    const vnMinutes = dateObj.getMinutes()
    
    // Format using date-fns
    // For the default format, format directly
    if (formatString === DEFAULT_DATE_FORMAT) {
      return `${vnHours.toString().padStart(2, '0')}:${vnMinutes.toString().padStart(2, '0')} ${vnDay.toString().padStart(2, '0')}/${(vnMonth + 1).toString().padStart(2, '0')}/${vnYear}`
    }

    // For other formats, use date-fns
    return format(dateObj, formatString)
  } catch (error) {
    console.error("Error formatting Vietnam date time:", error, dateString)
    return "-"
  }
}

/**
 * Get current time in Vietnam timezone as ISO string with +07:00 offset
 * 
 * @returns ISO string with +07:00 offset representing current Vietnam time
 */
export function getCurrentVietnamTime(): string {
  const now = new Date()
  // Add 7 hours to get Vietnam time
  const vietnamTimeMs = now.getTime() + VIETNAM_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000
  const vietnamDate = new Date(vietnamTimeMs)
  
  // Format as ISO string with +07:00 offset
  const year = vietnamDate.getUTCFullYear()
  const month = String(vietnamDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(vietnamDate.getUTCDate()).padStart(2, '0')
  const hours = String(vietnamDate.getUTCHours()).padStart(2, '0')
  const minutes = String(vietnamDate.getUTCMinutes()).padStart(2, '0')
  const seconds = String(vietnamDate.getUTCSeconds()).padStart(2, '0')
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+07:00`
}

/**
 * Get current time in Vietnam timezone formatted for display
 * 
 * @param formatString - Format string (default: "HH:mm dd/MM/yyyy")
 * @returns Formatted current time in Vietnam timezone
 */
export function getCurrentVietnamTimeFormatted(formatString: string = DEFAULT_DATE_FORMAT): string {
  return formatVietnamDateTime(getCurrentVietnamTime(), formatString)
}

/**
 * Convert a Date object to Vietnam timezone ISO string
 * 
 * @param date - Date object
 * @returns ISO string in UTC
 */
export function toVietnamISO(date: Date): string {
  return date.toISOString()
}

/**
 * Type guard to check if a string is a valid ISO date string
 */
export function isValidISODateString(dateString: string): boolean {
  try {
    const date = new Date(dateString)
    return !isNaN(date.getTime()) && dateString.includes('T')
  } catch {
    return false
  }
}

