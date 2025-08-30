import { AIProvider, AIMessage, AIResponse, AIStreamResponse } from "../ai-providers";

export class MockProvider implements AIProvider {
  name = 'mock';
  displayName = 'Mock AI Provider';

  constructor() {
    // Mock provider always works
  }

  async generateContent(prompt: string, options?: {
    systemInstruction?: string;
    maxTokens?: number;
    temperature?: number;
    responseFormat?: 'json' | 'text';
  }): Promise<AIResponse> {
    // Generate a mock response based on the prompt
    let mockText = '';
    
    if (prompt.toLowerCase().includes('workload') || prompt.toLowerCase().includes('summary') || prompt.toLowerCase().includes('school')) {
      mockText = `**Mock AI Analysis**: Your school management system shows active data collection with maintenance (60%), discipline (25%), and sports (15%) activities. Peak usage 8AM-12PM and 2PM-4PM.

**Key Recommendations**: 
• Schedule preventive maintenance
• Support peak periods with additional staff
• Continue WhatsApp integration

*Configure real AI keys for detailed analysis.*`;
    } else if (prompt.toLowerCase().includes('json')) {
      mockText = JSON.stringify({
        analysis: "Mock AI analysis of your school workload data shows balanced distribution across maintenance, discipline, and sports activities with good staff participation.",
        suggestions: [
          "Implement preventive maintenance scheduling to reduce urgent repairs",
          "Review peak activity periods for optimal staff allocation",
          "Set up automated escalation for high-priority incidents",
          "Create custom categories for school-specific activities",
          "Establish regular review meetings for continuous improvement"
        ]
      });
    } else if (prompt.toLowerCase().includes('maintenance')) {
      mockText = `**Maintenance Analysis**: Window repairs and door issues are most common. Lab equipment installations progressing well.

**Recommendations**: Schedule monthly inspections, create maintenance schedules, train staff on troubleshooting.

*Configure real AI keys for detailed analysis.*`;
    } else {
      mockText = `**Mock AI Response**: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"

This is a mock response. Configure CLAUDE_API_KEY or GEMINI_API_KEY for real AI analysis.

**Quick suggestions**: Review processes, automate logging, gather staff feedback.`;
    }

    // Handle JSON response format
    if (options?.responseFormat === 'json' && !mockText.startsWith('{')) {
      mockText = JSON.stringify({ response: mockText });
    }

    // Respect maxTokens option - truncate if too long
    if (options?.maxTokens && mockText.length > options.maxTokens * 4) {
      mockText = mockText.substring(0, options.maxTokens * 4) + '... [truncated]';
    }

    return {
      text: mockText,
      usage: {
        promptTokens: Math.floor(prompt.length / 4),
        completionTokens: Math.floor(mockText.length / 4),
        totalTokens: Math.floor((prompt.length + mockText.length) / 4),
      }
    };
  }

  async generateContentStream(messages: AIMessage[], options?: {
    systemInstruction?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<AIStreamResponse> {
    const lastMessage = messages[messages.length - 1];
    const response = await this.generateContent(lastMessage.content, options);
    
    const stream = new ReadableStream({
      async start(controller) {
        // Simulate streaming by chunking the response
        const text = response.text;
        const words = text.split(' ');
        
        for (const word of words) {
          controller.enqueue(new TextEncoder().encode(word + ' '));
          // Add small delay to simulate streaming
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        controller.close();
      }
    });

    return { stream };
  }

  async generateStructuredContent<T>(prompt: string, schema: any, options?: {
    systemInstruction?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<T> {
    // Handle WhatsApp message parsing schema specifically
    if (schema.properties?.category_id && schema.properties?.subcategory && schema.properties?.location && schema.properties?.notes) {
      // This is a WhatsApp message parsing request - analyze the message and provide appropriate response
      const messageContent = prompt.toLowerCase();
      let category_id = 'default';
      let subcategory = 'General Task';
      let location = 'Unknown Location';
      let notes = `Mock AI parsed: ${prompt}`;

      // Extract valid category from the schema enum if available
      if (schema.properties.category_id.enum && Array.isArray(schema.properties.category_id.enum)) {
        const validCategories = schema.properties.category_id.enum;
        
        // Smart categorization based on message content
        if (messageContent.includes('broken') || messageContent.includes('repair') || messageContent.includes('fix') || 
            messageContent.includes('maintenance') || messageContent.includes('leak') || messageContent.includes('install')) {
          const maintenanceCategory = validCategories.find((cat: string) => cat.includes('maintenance') || cat.includes('repair'));
          category_id = maintenanceCategory || validCategories[0];
          
          if (messageContent.includes('window')) subcategory = 'Window Repair';
          else if (messageContent.includes('door')) subcategory = 'Door Repair';
          else if (messageContent.includes('desk') || messageContent.includes('furniture')) subcategory = 'Furniture Repair';
          else if (messageContent.includes('light') || messageContent.includes('bulb')) subcategory = 'Lighting Issue';
          else if (messageContent.includes('water') || messageContent.includes('leak') || messageContent.includes('tap')) subcategory = 'Plumbing Issue';
          else subcategory = 'General Maintenance';
          
        } else if (messageContent.includes('misbehav') || messageContent.includes('fight') || 
                  messageContent.includes('discipline') || messageContent.includes('bullying')) {
          const disciplineCategory = validCategories.find((cat: string) => cat.includes('discipline') || cat.includes('behavior'));
          category_id = disciplineCategory || validCategories[0];
          subcategory = 'Behavioral Issue';
          
        } else if (messageContent.includes('clean') || messageContent.includes('washing')) {
          const maintenanceCategory = validCategories.find((cat: string) => cat.includes('maintenance') || cat.includes('repair'));
          category_id = maintenanceCategory || validCategories[0];
          subcategory = 'Cleaning Task';
          
        } else if (messageContent.includes('sport') || messageContent.includes('game') || messageContent.includes('training')) {
          const sportsCategory = validCategories.find((cat: string) => cat.includes('sport') || cat.includes('athletic'));
          category_id = sportsCategory || validCategories[0];
          subcategory = 'Sports Activity';
          
        } else {
          // Default to first available category
          category_id = validCategories[0];
          subcategory = 'General Issue';
        }
      }

      // Extract location from message
      if (messageContent.includes('classroom')) {
        const classMatch = messageContent.match(/classroom\s*([a-z0-9]+)/i);
        location = classMatch ? `Classroom ${classMatch[1].toUpperCase()}` : 'Classroom';
      } else if (messageContent.includes('room')) {
        const roomMatch = messageContent.match(/room\s*([a-z0-9]+)/i);
        location = roomMatch ? `Room ${roomMatch[1].toUpperCase()}` : 'Room';
      } else if (messageContent.includes('lab')) {
        location = 'Laboratory';
      } else if (messageContent.includes('playground') || messageContent.includes('field')) {
        location = 'Playground';
      } else if (messageContent.includes('office')) {
        location = 'Office';
      } else if (messageContent.includes('corridor') || messageContent.includes('hallway')) {
        location = 'Corridor';
      } else if (messageContent.includes('grade')) {
        const gradeMatch = messageContent.match(/grade\s*([0-9]+)/i);
        location = gradeMatch ? `Grade ${gradeMatch[1]} Area` : 'Grade Area';
      }

      return {
        category_id,
        subcategory,
        location,
        notes
      } as T;
    }

    // Handle analysis and suggestions schema
    if (schema.properties?.analysis && schema.properties?.suggestions) {
      // Generate school-specific analysis based on prompt context
      let analysis = "Mock AI analysis: Your school workload data shows good distribution across team members with opportunities for optimization.";
      let suggestions = [
        "Implement automated reporting workflows",
        "Review task categorization system", 
        "Schedule regular team productivity reviews",
        "Consider workload balancing strategies"
      ];

      if (prompt.toLowerCase().includes('school') || prompt.toLowerCase().includes('maintenance') || prompt.toLowerCase().includes('activity')) {
        analysis = `**Mock AI Analysis**: Your school management system shows good activity tracking across maintenance, discipline, and sports categories. Active staff participation with structured workflows is evident.

**Key Patterns**: Maintenance activities dominate, good geographic distribution, WhatsApp integration working well.

**Note**: This is a mock response. Configure real AI keys for detailed analysis.`;

        suggestions = [
          "Implement preventive maintenance scheduling",
          "Set up automated escalation for priority incidents", 
          "Create location-based activity clustering",
          "Configure advanced WhatsApp message processing"
        ];
      }

      return {
        analysis,
        suggestions
      } as T;
    }
    
    // Fallback to basic JSON response
    const textResponse = await this.generateContent(prompt, { ...options, responseFormat: 'json' });
    return JSON.parse(textResponse.text);
  }
}