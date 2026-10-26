/**
 * Format a name with proper capitalization
 * Handles: "junfranz rock c. calibo" → "Junfranz Rock C. Calibo"
 */
export function formatName(name: string): string {
  if (!name) return '';
  
  return name
    .split(' ')
    .map(word => {
      // Handle middle initials like "C." or "c."
      if (word.length <= 2 && word.endsWith('.')) {
        return word.toUpperCase();
      }
      
      // Capitalize first letter, lowercase rest
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Format input value as user types (for form inputs)
 */
export function formatNameInput(value: string): string {
  if (!value) return '';
  
  // Split by spaces and capitalize each word as it's being typed
  return value
    .split(' ')
    .map(word => {
      if (word.length === 0) return word;
      
      // Keep single letters uppercase (for middle initials)
      if (word.length === 1) {
        return word.toUpperCase();
      }
      
      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
