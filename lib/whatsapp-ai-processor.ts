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

const DEFAULT_AI_PARSER_PROMPT = `You are a school incident parser. Extract:
- category_id: (choose appropriate ID)
- subcategory: (brief description like "Broken Window") 
- location: (CRITICAL: extract specific location from message. Examples: "Classroom A", "Main Office", "Laboratory". If unclear, use "General Area")
- notes: (full message content)

Message: "{message}"
Available categories: {categories}

Return ONLY valid JSON. Focus on accurate location extraction.`;

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
  let subcategory = 'General Issue';
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
      if (lowerMessage.includes('desk') || lowerMessage.includes('chair')) {
        subcategory = 'Furniture Repair';
      } else if (lowerMessage.includes('window') || lowerMessage.includes('door')) {
        subcategory = 'Building Maintenance';
      } else if (lowerMessage.includes('light') || lowerMessage.includes('electrical')) {
        subcategory = 'Electrical Issue';
      } else {
        subcategory = 'General Repair';
      }
    }
  } else if (disciplineKeywords.some(keyword => lowerMessage.includes(keyword))) {
    const disciplineCategory = categories.find(c => 
      c.name.toLowerCase().includes('discipline') || 
      c.name.toLowerCase().includes('behavior')
    );
    if (disciplineCategory) {
      category_id = disciplineCategory.id;
      subcategory = 'Student Behavior';
    }
  } else if (sportsKeywords.some(keyword => lowerMessage.includes(keyword))) {
    const sportsCategory = categories.find(c => 
      c.name.toLowerCase().includes('sport') || 
      c.name.toLowerCase().includes('athletic')
    );
    if (sportsCategory) {
      category_id = sportsCategory.id;
      subcategory = 'Sports Activity';
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