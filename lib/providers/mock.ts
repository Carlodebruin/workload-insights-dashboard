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
      mockText = `# 🏫 School Workload Analysis (Mock AI Response)

**Overview:**
Your school management system is collecting valuable activity data. Here's what the patterns suggest:

## 📊 Key Insights:
- **Activity Distribution**: Maintenance requests dominate (60%), followed by discipline incidents (25%) and sports activities (15%)
- **Peak Times**: Most activities logged between 8 AM - 12 PM and 2 PM - 4 PM
- **Staff Engagement**: Active logging indicates good system adoption
- **Location Patterns**: Classrooms and playground areas show highest activity

## 🎯 Recommendations:
- **Preventive Maintenance**: Schedule regular inspections to reduce reactive maintenance
- **Staff Training**: Provide additional support for peak activity periods  
- **Resource Allocation**: Consider additional maintenance staff during high-activity hours
- **Digital Integration**: WhatsApp integration is improving reporting efficiency

## 📈 Success Indicators:
- Faster incident response times through automated categorization
- Better resource planning through activity pattern analysis
- Improved staff coordination via structured workflows

*Note: This is a mock AI analysis for development/demo purposes. In production, Claude or Gemini would provide detailed insights based on your actual school data.*`;
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
      mockText = `## 🔧 Maintenance Activity Analysis

Based on your maintenance request patterns:

**Current Status:**
- Window repairs and door issues are most common
- Lab equipment installations showing good progress
- Ceiling leaks require immediate attention

**Recommendations:**
- Schedule monthly facility inspections
- Create maintenance schedules for high-use areas
- Train staff on basic troubleshooting

This analysis would be much more detailed with real AI processing of your actual maintenance data.`;
    } else {
      mockText = `I understand you're asking about: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"

This is a mock AI response for development purposes. In a production environment with real API keys configured, this would be handled by Claude or Gemini AI for:

🎓 **School-Specific Analysis:**
- Activity pattern recognition
- Resource optimization suggestions  
- Staff workload balancing
- Predictive maintenance planning

💡 **To enable real AI insights:**
1. Configure CLAUDE_API_KEY or GEMINI_API_KEY in environment
2. Set valid API keys (not test placeholders)
3. System will automatically use real AI providers

**Mock suggestions for now:**
- Review your current school processes
- Look for automation opportunities in activity logging
- Consider staff feedback for system improvements`;
    }

    // Handle JSON response format
    if (options?.responseFormat === 'json' && !mockText.startsWith('{')) {
      mockText = JSON.stringify({ response: mockText });
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
    // Generate a mock structured response that matches the expected schema
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
        analysis = `# 🏫 School Activity Analysis

Your school management system is effectively capturing operational data across multiple categories:

## Current Status:
- **51 total activities** tracked across maintenance, discipline, and sports categories
- **Active staff participation** with 5 users contributing to the system
- **Diverse activity types** showing comprehensive school operations monitoring
- **Recent maintenance focus** with window repairs, lab installations, and facility improvements

## Key Patterns:
- Maintenance activities dominate the workload (classroom repairs, lab equipment)
- Geographic distribution shows activity across classrooms, lab, and campus areas  
- Staff assignment working well with activities moving through Open → In Progress → Completed
- WhatsApp integration successfully converting incident reports to structured activities

## Optimization Opportunities:
The data suggests good system adoption with room for enhanced workflow automation and predictive maintenance planning.`;

        suggestions = [
          "Implement preventive maintenance scheduling based on activity patterns",
          "Set up automated escalation for high-priority school incidents", 
          "Create location-based activity clustering for facility management",
          "Establish regular review cycles for completed activity analysis",
          "Configure advanced WhatsApp message processing for faster incident response",
          "Develop staff workload balancing across different activity categories"
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