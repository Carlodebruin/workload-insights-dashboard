import { logSecureInfo, logSecureError } from './secure-logger';

/**
 * Reference Number Service
 * Generates easy-to-use reference numbers for tasks/activities
 * Format: CATEGORY-XXXX (e.g., MAIN-1234, ELEC-5678, CLEAN-9012)
 */

export interface ReferenceNumberOptions {
  categoryName?: string;
  activityId: string;
  customPrefix?: string;
}

export interface ParsedReference {
  prefix: string;
  number: string;
  isValid: boolean;
  activityId?: string;
}

/**
 * Generates a user-friendly reference number from activity data
 */
export function generateReferenceNumber(options: ReferenceNumberOptions): string {
  try {
    const { activityId } = options;
    
    // Extract clean short reference from activity ID
    // For complex IDs like "CMEZ3MN6H0002L50405SUBNG0", show just the last meaningful part
    let cleanReference = activityId;
    
    // If ID is longer than 8 characters, take the last 6 characters for clean display
    if (activityId.length > 8) {
      cleanReference = activityId.slice(-6);
    }
    
    const referenceNumber = `#${cleanReference.toUpperCase()}`;
    
    logSecureInfo('Reference number generated', {
      operation: 'generate_reference',
      timestamp: new Date().toISOString()
    }, {
      activityId: activityId.substring(0, 8),
      referenceNumber
    });
    
    return referenceNumber;
    
  } catch (error) {
    logSecureError('Failed to generate reference number', {
      operation: 'generate_reference',
      timestamp: new Date().toISOString()
    }, error instanceof Error ? error : undefined);
    
    // Fallback reference - also use clean format for fallback
    const cleanId = options.activityId.length > 8 ? options.activityId.slice(-6) : options.activityId;
    return `#${cleanId.toUpperCase()}`;
  }
}

/**
 * Extracts a meaningful prefix from category name
 */
function extractPrefixFromCategory(categoryName: string): string {
  const name = categoryName.toLowerCase().trim();
  
  // Predefined category mappings for common categories
  const categoryMappings: { [key: string]: string } = {
    'maintenance': 'MAIN',
    'repair': 'MAIN',
    'electrical': 'ELEC',
    'plumbing': 'PLUMB',
    'cleaning': 'CLEAN',
    'hvac': 'HVAC',
    'security': 'SEC',
    'it': 'IT',
    'technology': 'TECH',
    'grounds': 'GRND',
    'landscaping': 'GRND',
    'administrative': 'ADMIN',
    'discipline': 'DISC',
    'academic': 'ACAD',
    'sports': 'SPORT',
    'event': 'EVENT',
    'emergency': 'EMRG',
    'safety': 'SAFE'
  };
  
  // Check for exact matches first
  for (const [keyword, prefix] of Object.entries(categoryMappings)) {
    if (name.includes(keyword)) {
      return prefix;
    }
  }
  
  // Generate prefix from first letters of words
  const words = name.split(/\s+/).filter(word => word.length > 0);
  
  if (words.length >= 2) {
    // Use first letter of first two words
    return (words[0].charAt(0) + words[1].charAt(0) + words[0].charAt(1) + words[0].charAt(2))
      .toUpperCase().substring(0, 4);
  } else if (words.length === 1 && words[0].length >= 4) {
    // Use first 4 letters of single word
    return words[0].substring(0, 4).toUpperCase();
  }
  
  // Fallback to generic
  return 'TASK';
}

/**
 * Generates a clean suffix from activity ID
 * Uses the actual activity ID prefix for consistency with dashboard
 */
function generateCleanNumericSuffix(activityId: string): string {
  try {
    // Use first 5-6 characters of the activity ID to match dashboard format
    // Dashboard shows IDs like "SUBNG0" - use actual ID prefix
    const idPrefix = activityId.substring(0, 6).toUpperCase();
    return idPrefix;
  } catch (error) {
    // Fallback to using last 6 chars if something goes wrong
    return activityId.slice(-6).toUpperCase();
  }
}

/**
 * Parses a reference number and validates its format
 */
export function parseReferenceNumber(referenceNumber: string): ParsedReference {
  try {
    const cleaned = referenceNumber.trim().toUpperCase();
    
    // Handle dashboard format (#SUBNG0)
    if (cleaned.startsWith('#')) {
      const activityId = cleaned.substring(1);
      if (/^[A-Z0-9]{4,8}$/.test(activityId)) {
        return {
          prefix: '#',
          number: activityId,
          isValid: true
        };
      }
    }
    
    // Handle old format for backward compatibility
    const parts = cleaned.split('-');
    if (parts.length === 2) {
      const [prefix, number] = parts;
      if (/^[A-Z]{3,5}$/.test(prefix) && /^[A-Z0-9]{4,6}$/.test(number)) {
        return {
          prefix,
          number,
          isValid: true
        };
      }
    }
    
    return { prefix: '', number: '', isValid: false };
    
  } catch (error) {
    logSecureError('Failed to parse reference number', {
      operation: 'parse_reference',
      timestamp: new Date().toISOString()
    }, error instanceof Error ? error : undefined);
    
    return { prefix: '', number: '', isValid: false };
  }
}

/**
 * Finds activity by reference number
 */
export async function findActivityByReference(
  referenceNumber: string,
  prismaClient: any
): Promise<any | null> {
  try {
    const parsed = parseReferenceNumber(referenceNumber);
    
    if (!parsed.isValid) {
      return null;
    }
    
    // For dashboard format (#SUBNG0 or short reference), search by activity ID
    if (parsed.prefix === '#') {
      const searchTerm = parsed.number.toLowerCase();
      
      // Try multiple search strategies for maximum compatibility
      let activity: any[] = [];
      
      // Strategy 1: Exact match
      activity = await prismaClient.activity.findMany({
        where: {
          id: {
            equals: searchTerm
          }
        },
        include: {
          category: { select: { name: true } },
          user: { select: { name: true } },
          assignedTo: { select: { name: true } }
        }
      });
      
      // Strategy 2: Starts with (for full IDs)
      if (activity.length === 0) {
        activity = await prismaClient.activity.findMany({
          where: {
            id: {
              startsWith: searchTerm
            }
          },
          include: {
            category: { select: { name: true } },
            user: { select: { name: true } },
            assignedTo: { select: { name: true } }
          }
        });
      }
      
      // Strategy 3: Ends with (for simplified references like #SUBNG0)
      if (activity.length === 0) {
        activity = await prismaClient.activity.findMany({
          where: {
            id: {
              endsWith: searchTerm
            }
          },
          include: {
            category: { select: { name: true } },
            user: { select: { name: true } },
            assignedTo: { select: { name: true } }
          }
        });
      }
      
      // Strategy 4: Contains (last resort for partial matches)
      if (activity.length === 0) {
        activity = await prismaClient.activity.findMany({
          where: {
            id: {
              contains: searchTerm
            }
          },
          include: {
            category: { select: { name: true } },
            user: { select: { name: true } },
            assignedTo: { select: { name: true } }
          }
        });
      }
      
      return activity[0] || null;
    }
    
    // Handle old format for backward compatibility
    const activities = await prismaClient.activity.findMany({
      where: {
        id: {
          startsWith: parsed.number.toLowerCase()
        }
      },
      include: {
        category: { select: { name: true } },
        user: { select: { name: true } },
        assignedTo: { select: { name: true } }
      }
    });
    
    return activities[0] || null;
    
  } catch (error) {
    logSecureError('Failed to find activity by reference', {
      operation: 'find_by_reference',
      timestamp: new Date().toISOString()
    }, error instanceof Error ? error : undefined);
    
    return null;
  }
}

/**
 * Generates reference numbers for existing activities (migration utility)
 */
export async function generateReferenceForActivity(
  activity: any
): Promise<string> {
  return generateReferenceNumber({
    categoryName: activity.category?.name,
    activityId: activity.id
  });
}

/**
 * Validates if a reference number matches expected format
 */
export function isValidReferenceFormat(referenceNumber: string): boolean {
  const parsed = parseReferenceNumber(referenceNumber);
  return parsed.isValid;
}

/**
 * Creates a display-friendly reference with optional context
 */
export function formatReferenceDisplay(
  referenceNumber: string,
  includeContext: boolean = false,
  activity?: any
): string {
  if (!includeContext || !activity) {
    return referenceNumber;
  }
  
  return `${referenceNumber} (${activity.subcategory} - ${activity.location})`;
}

// Export utility functions for external use
export {
  extractPrefixFromCategory
};