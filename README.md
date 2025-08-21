<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Workload Insights Dashboard

A comprehensive school workload tracking and incident management system with AI-powered insights.

## Features

- **Multi-Provider AI Support**: Choose from all Google Gemini, Anthropic Claude, DeepSeek, or Moonshot Kimi
- **Activity Tracking**: Log and manage school incidents across multiple categories
- **AI Insights**: Get intelligent analysis and chat with your data
- **Geographic Mapping**: Visualize incidents on interactive maps with geofencing
- **Task Management**: Assign, track, and resolve incidents with full workflow support

## Run Locally

**Prerequisites:** Node.js 18+

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure AI Providers:**
   Copy `.env.example` to `.env.local` and add your API keys:
   ```bash
   cp .env.example .env.local
   ```
   
   Add at least one API key:
   - `GEMINI_API_KEY` - For Google Gemini
   - `CLAUDE_API_KEY` - For Anthropic Claude  
   - `DEEPSEEK_API_KEY` - For DeepSeek
   - `KIMI_API_KEY` - For Moonshot Kimi

3. **Run the app:**
   ```bash
   npm run dev
   ```

## AI Provider Configuration

The app automatically detects available AI providers based on your configured API keys. You can switch between providers in the AI Insights page. Each provider offers different capabilities:

- **Google Gemini**: Best for multimodal analysis (text + images)
- **Anthropic Claude**: Excellent reasoning and analysis capabilities  
- **DeepSeek**: Cost-effective with strong performance
- **Moonshot Kimi**: Long context support for large datasets
# Force rebuild Thu Aug 21 16:46:28 SAST 2025
