import { getWorkingAIProvider } from './ai-factory';
import { MockProvider } from './providers/mock';
import { logger } from './logger';

export interface Category {
  id: string;
  name: string;
  isSystem: boolean;
}

export interface ParsedActivityData {
  category_id: string;
  subcategory: string;
  location: string;
  notes: string;
}

interface ParseMessageOptions {
  maxTokens?: number;
  temperature?: number;
  systemInstruction?: string;
}

const DEFAULT_AI_PARSER_PROMPT = `You are an expert school incident parser. Use Chain-of-Thought reasoning to accurately categorize and extract information from messages.

STEP-BY-STEP ANALYSIS PROCESS:
1. READ the message carefully and identify key details
2. ANALYZE the type of incident/activity described
3. DETERMINE the most appropriate category from available options
4. EXTRACT specific location information
5. FORMULATE a clear subcategory description

CATEGORY REASONING EXAMPLES:

MAINTENANCE/REPAIR INCIDENTS:
- Keywords: broken, repair, fix, leak, damage, install, maintenance
- Think: "Is something physically broken or needing repair?"
- Examples: "Broken desk" → Maintenance, "Furniture Repair", specific location
- Examples: "Water leak" → Maintenance, "Plumbing Issue", specific location

BEHAVIORAL/DISCIPLINE INCIDENTS:
- Keywords: misbehaving, fighting, bullying, discipline, behavior issues
- Think: "Does this involve student conduct or discipline?"
- Examples: "Student fighting" → Discipline, "Physical Altercation", specific location

ACADEMIC/EDUCATIONAL ACTIVITIES:
- Keywords: class, lesson, exam, assignment, academic
- Think: "Is this related to teaching and learning?"
- Examples: "Exam supervision" → Academic, "Test Administration", specific location

ADMINISTRATIVE TASKS:
- Keywords: meeting, paperwork, registration, administration
- Think: "Is this related to school administration or office work?"
- Examples: "Parent meeting" → Administrative, "Parent Conference", specific location

SPORTS/RECREATIONAL ACTIVITIES:
- Keywords: sport, game, match, training, physical education
- Think: "Is this related to sports or recreational activities?"
- Examples: "Soccer practice" → Sports, "Training Session", specific location

LOCATION EXTRACTION GUIDELINES:
- PRIORITIZE specific mentions: "Classroom A", "Room 101", "Main Office"
- RECOGNIZE common areas: "playground", "laboratory", "library", "gymnasium"
- INFER from context: "in grade 2" suggests "Grade 2 Classroom"
- DEFAULT to "General Area" only if location is truly unclear

REASONING PROCESS:
Think through each message step-by-step:
1. What is the main issue or activity?
2. Which category best fits this type of incident?
3. What specific location is mentioned or can be inferred?
4. How should I describe the subcategory clearly and concisely?

Message: "{message}"
Available categories: {categories}

Use your reasoning process and return ONLY valid JSON with your final categorization.`;

/**
 * Parses a WhatsApp message using AI to extract structured activity data
 * @param message The raw WhatsApp message text
 * @param categories Available categories from the database
 * @param options Optional parsing configuration
 * @returns Parsed activity data with category_id, subcategory, location, and notes
 */
export async function parseWhatsAppMessage(
  message: string,
  categories: Category[],
  options: ParseMessageOptions = {}
): Promise<ParsedActivityData> {
  try {
    logger.info('Starting WhatsApp message parsing', {
      operation: 'parse_whatsapp_message',
      timestamp: new Date().toISOString()
    });

    // Validate inputs
    if (!message || message.trim().length === 0) {
      throw new Error('Message is required and cannot be empty');
    }

    if (!categories || categories.length === 0) {
      throw new Error('Categories array is required and cannot be empty');
    }

    // Get AI provider (fallback to mock if no real AI configured)
    let aiProvider;
    try {
      aiProvider = await getWorkingAIProvider();
      logger.info('Using AI provider for message parsing', {
        operation: 'parse_whatsapp_message',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.warn('No AI provider available, falling back to MockProvider', {
        operation: 'parse_whatsapp_message',
        timestamp: new Date().toISOString()
      });
      aiProvider = new MockProvider();
    }

    const validCategoryIds = categories.map(c => c.id);
    const systemInstruction = options.systemInstruction || DEFAULT_AI_PARSER_PROMPT;
    
    // Build the prompt using template replacement
    const categoriesText = categories.map(c => `${c.id} (${c.name})`).join(', ');
    const prompt = systemInstruction
      .replace('{message}', message)
      .replace('{categories}', categoriesText);

    // Define the expected JSON schema
    const schema = {
      type: "object",
      properties: {
        category_id: { 
          type: "string", 
          enum: validCategoryIds,
          description: "Must be one of the valid category IDs from the available categories"
        },
        subcategory: { 
          type: "string",
          description: "Specific type of incident or activity within the category"
        },
        location: { 
          type: "string",
          description: "Specific location where the incident/activity occurred"
        },
        notes: { 
          type: "string",
          description: "Detailed description and additional context about the incident/activity"
        }
      },
      required: ["category_id", "subcategory", "location", "notes"]
    };

    // Generate structured content using AI
    logger.info('Calling AI provider for structured content generation', {
      operation: 'parse_whatsapp_message',
      timestamp: new Date().toISOString()
    });

    const parsedData = await (aiProvider as any).generateStructuredContent(
      prompt, 
      schema,
      {
        systemInstruction,
        maxTokens: options.maxTokens || 500,
        temperature: options.temperature || 0.3,
      }
    ) as ParsedActivityData;

    logger.info('AI parsing completed successfully', {
      operation: 'parse_whatsapp_message',
      timestamp: new Date().toISOString()
    });

    // Validate and sanitize the response
    const sanitizedData = validateAndSanitizeParsedData(parsedData, validCategoryIds, categories);
    
    logger.info('WhatsApp message parsing completed', {
      operation: 'parse_whatsapp_message',
      timestamp: new Date().toISOString()
    });

    return sanitizedData;

  } catch (error) {
    logger.error('WhatsApp message parsing failed', {
      operation: 'parse_whatsapp_message',
      timestamp: new Date().toISOString()
    }, error);

    // Return fallback data to ensure the system continues working
    return createFallbackActivityData(message, categories);
  }
}

/**
 * Validates and sanitizes parsed data from AI
 */
function validateAndSanitizeParsedData(
  data: ParsedActivityData, 
  validCategoryIds: string[], 
  categories: Category[]
): ParsedActivityData {
  const sanitized: ParsedActivityData = {
    category_id: data.category_id,
    subcategory: data.subcategory || 'General Issue',
    location: data.location || 'Unknown Location',
    notes: data.notes || 'No additional details provided'
  };

  // Validate category_id
  if (!sanitized.category_id || !validCategoryIds.includes(sanitized.category_id)) {
    logger.warn('Invalid category_id returned by AI, using fallback', {
      operation: 'validate_parsed_data',
      timestamp: new Date().toISOString()
    });
    
    // Find a reasonable fallback category
    const maintenanceCategory = categories.find(c => 
      c.name.toLowerCase().includes('maintenance') || 
      c.name.toLowerCase().includes('repair')
    );
    const generalCategory = categories.find(c => 
      c.name.toLowerCase().includes('general') ||
      c.name.toLowerCase().includes('other')
    );
    
    sanitized.category_id = maintenanceCategory?.id || generalCategory?.id || validCategoryIds[0];
  }

  // Sanitize text fields
  sanitized.subcategory = sanitized.subcategory.trim().substring(0, 100);
  sanitized.location = sanitized.location.trim().substring(0, 100);
  sanitized.notes = sanitized.notes.trim().substring(0, 500);

  return sanitized;
}

/**
 * Generates a smart subcategory from message content
 * Converts messages like "clean classroom" into "Clean Classroom"
 */
function generateSmartSubcategory(message: string): string {
  // Clean up the message
  let cleaned = message.trim();
  
  // Remove common prefixes/phrases
  const prefixesToRemove = [
    'please ', 'can you ', 'need to ', 'help with ', 'urgent ', 'asap ',
    'hello ', 'hi ', 'hey ', 'excuse me ', 'sorry ', 'thanks '
  ];
  
  for (const prefix of prefixesToRemove) {
    if (cleaned.toLowerCase().startsWith(prefix)) {
      cleaned = cleaned.substring(prefix.length).trim();
    }
  }
  
  // Remove common suffixes
  const suffixesToRemove = [
    ' please', ' thanks', ' thank you', ' asap', ' urgently', ' now'
  ];
  
  for (const suffix of suffixesToRemove) {
    if (cleaned.toLowerCase().endsWith(suffix)) {
      cleaned = cleaned.substring(0, cleaned.length - suffix.length).trim();
    }
  }
  
  // Smart task title generation based on content analysis
  const lowerCleaned = cleaned.toLowerCase();
  
  // Specific task patterns for better titles
  if (lowerCleaned.includes('clean') || lowerCleaned.includes('washing')) {
    if (lowerCleaned.includes('toilet') || lowerCleaned.includes('bathroom')) return 'Clean Toilet';
    if (lowerCleaned.includes('classroom') || lowerCleaned.includes('class')) return 'Clean Classroom';
    if (lowerCleaned.includes('window')) return 'Clean Windows';
    if (lowerCleaned.includes('floor')) return 'Clean Floor';
    return 'Cleaning Task';
  }
  
  if (lowerCleaned.includes('broken') || lowerCleaned.includes('fix') || lowerCleaned.includes('repair')) {
    if (lowerCleaned.includes('door')) return 'Fix Door';
    if (lowerCleaned.includes('window')) return 'Fix Window';
    if (lowerCleaned.includes('desk') || lowerCleaned.includes('table')) return 'Fix Furniture';
    if (lowerCleaned.includes('light') || lowerCleaned.includes('bulb')) return 'Fix Lighting';
    if (lowerCleaned.includes('tap') || lowerCleaned.includes('water') || lowerCleaned.includes('leak')) return 'Fix Plumbing';
    return 'Repair Task';
  }
  
  if (lowerCleaned.includes('install') || lowerCleaned.includes('setup') || lowerCleaned.includes('mount')) {
    return 'Installation Task';
  }
  
  // If too long, take first meaningful part
  if (cleaned.length > 35) {
    const words = cleaned.split(' ');
    if (words.length > 5) {
      cleaned = words.slice(0, 5).join(' ') + '...';
    }
  }
  
  // Convert to title case
  const titleCase = cleaned.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  // Return meaningful title or fallback
  return titleCase.length > 3 ? titleCase : 'General Task';
}

/**
 * Creates fallback activity data when AI parsing fails
 */
function createFallbackActivityData(message: string, categories: Category[]): ParsedActivityData {
  logger.info('Creating fallback activity data', {
    operation: 'create_fallback_data',
    timestamp: new Date().toISOString()
  });

  // Simple keyword-based fallback logic
  const lowerMessage = message.toLowerCase();
  let category_id = categories[0]?.id; // Default to first category
  let subcategory = generateSmartSubcategory(message);
  let location = 'Unknown Location';

  // Try to identify category based on keywords
  const maintenanceKeywords = ['broken', 'repair', 'fix', 'maintenance', 'leak', 'damage', 'install'];
  const disciplineKeywords = ['misbehav', 'fight', 'bullying', 'discipline', 'behavior'];
  const sportsKeywords = ['sport', 'game', 'match', 'tournament', 'training'];

  if (maintenanceKeywords.some(keyword => lowerMessage.includes(keyword))) {
    const maintenanceCategory = categories.find(c => 
      c.name.toLowerCase().includes('maintenance') || 
      c.name.toLowerCase().includes('repair')
    );
    if (maintenanceCategory) {
      category_id = maintenanceCategory.id;
      // Use smart subcategory but add context if specific items detected
      if (lowerMessage.includes('desk') || lowerMessage.includes('chair')) {
        subcategory = subcategory.includes('Desk') || subcategory.includes('Chair') ? subcategory : `${subcategory} (Furniture)`;
      } else if (lowerMessage.includes('window') || lowerMessage.includes('door')) {
        subcategory = subcategory.includes('Window') || subcategory.includes('Door') ? subcategory : `${subcategory} (Building)`;
      } else if (lowerMessage.includes('light') || lowerMessage.includes('electrical')) {
        subcategory = subcategory.includes('Light') || subcategory.includes('Electric') ? subcategory : `${subcategory} (Electrical)`;
      }
    }
  } else if (disciplineKeywords.some(keyword => lowerMessage.includes(keyword))) {
    const disciplineCategory = categories.find(c => 
      c.name.toLowerCase().includes('discipline') || 
      c.name.toLowerCase().includes('behavior')
    );
    if (disciplineCategory) {
      category_id = disciplineCategory.id;
      // Keep smart subcategory for discipline issues
    }
  } else if (sportsKeywords.some(keyword => lowerMessage.includes(keyword))) {
    const sportsCategory = categories.find(c => 
      c.name.toLowerCase().includes('sport') || 
      c.name.toLowerCase().includes('athletic')
    );
    if (sportsCategory) {
      category_id = sportsCategory.id;
      // Keep smart subcategory for sports activities
    }
  }

  // Try to extract location
  if (lowerMessage.includes('classroom')) {
    const classMatch = lowerMessage.match(/classroom\s*([a-z0-9]+)/i);
    location = classMatch ? `Classroom ${classMatch[1].toUpperCase()}` : 'Classroom';
  } else if (lowerMessage.includes('room')) {
    const roomMatch = lowerMessage.match(/room\s*([a-z0-9]+)/i);
    location = roomMatch ? `Room ${roomMatch[1].toUpperCase()}` : 'Room';
  } else if (lowerMessage.includes('lab')) {
    location = 'Laboratory';
  } else if (lowerMessage.includes('playground') || lowerMessage.includes('field')) {
    location = 'Playground';
  } else if (lowerMessage.includes('office')) {
    location = 'Office';
  } else if (lowerMessage.includes('corridor') || lowerMessage.includes('hallway')) {
    location = 'Corridor';
  }

  return {
    category_id,
    subcategory,
    location,
    notes: `Fallback parsing: ${message}`
  };
}

/**
 * Creates a simple WhatsApp message parser that uses basic keyword matching
 * Useful as a backup when AI services are unavailable
 */
export function parseWhatsAppMessageSimple(
  message: string, 
  categories: Category[]
): ParsedActivityData {
  logger.info('Using simple keyword-based message parsing', {
    operation: 'parse_whatsapp_simple',
    timestamp: new Date().toISOString()
  });

  return createFallbackActivityData(message, categories);
}

// Export types for use in other modules
export type { ParseMessageOptions };