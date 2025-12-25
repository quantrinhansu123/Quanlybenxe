/**
 * Vietnam Timezone Utilities
 * 
 * The backend stores Vietnam time with UTC "Z" suffix (mislabeled as UTC).
 * These utilities handle display correctly by treating stored time as Vietnam time.
 */

/**
 * Format a stored ISO timestamp (Vietnam time stored as UTC) for display
 * @param isoString - ISO string from database (e.g., "2024-12-25T23:54:00.000Z")
 * @param formatStr - Format pattern: "HH:mm", "dd/MM/yyyy", "dd/MM/yyyy HH:mm", "HH:mm dd/MM/yyyy", "HH:mm dd/MM", "yyyy-MM-dd"
 * @returns Formatted string in Vietnam time
 */
export function formatVietnamTime(isoString: string | null | undefined, formatStr: string = "HH:mm"): string {
  if (!isoString) return "-";
  
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "-";
    
    // Use UTC methods since stored time is Vietnam time (just mislabeled as UTC)
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    
    // Handle common format patterns
    switch (formatStr) {
      case "HH:mm":
        return `${hours}:${minutes}`;
      case "dd/MM/yyyy":
        return `${day}/${month}/${year}`;
      case "dd/MM/yyyy HH:mm":
        return `${day}/${month}/${year} ${hours}:${minutes}`;
      case "HH:mm dd/MM/yyyy":
        return `${hours}:${minutes} ${day}/${month}/${year}`;
      case "HH:mm dd/MM":
        return `${hours}:${minutes} ${day}/${month}`;
      case "yyyy-MM-dd":
        return `${year}-${month}-${day}`;
      default:
        // Fallback: replace format tokens
        return formatStr
          .replace("yyyy", String(year))
          .replace("MM", month)
          .replace("dd", day)
          .replace("HH", hours)
          .replace("mm", minutes);
    }
  } catch {
    return "-";
  }
}
