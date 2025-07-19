import {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerationConfig,
} from '@google/generative-ai';
import type {
  ChapterGenerationRequest,
  ChapterGenerationResponse,
  ContextAnalysis,
  ConsistencyReport,
  ProjectContextForAI,
  AIServiceConfig,
} from '../types/ai';
import {
  AIServiceError,
  AIRateLimitError,
  AIQuotaExceededError,
  AIContentFilterError,
} from '../types/ai';

export class AIService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private config: AIServiceConfig;

  constructor(config?: Partial<AIServiceConfig>) {
    this.config = {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: 'gemini-1.5-pro',
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 60000,
      ...config,
    };

    if (!this.config.apiKey) {
      throw new Error('Gemini API key is required');
    }

    this.genAI = new GoogleGenerativeAI(this.config.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: this.config.model });
  }

  /**
   * Generate a chapter using Gemini AI with project context
   */
  async generateChapter(
    request: ChapterGenerationRequest
  ): Promise<ChapterGenerationResponse> {
    const prompt = this.buildChapterPrompt(request);

    try {
      const result = await this.executeWithRetry(async () => {
        const generationConfig: GenerationConfig = {
          temperature: 0.8,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: Math.min(
            8192,
            Math.ceil(request.parameters.length * 1.5)
          ), // Rough token estimation
        };

        const response = await this.model.generateContent(prompt);

        return response;
      });

      const content = result.response.text();
      const wordCount = this.countWords(content);

      return {
        content,
        wordCount,
        generatedAt: new Date(),
        parameters: request.parameters,
      };
    } catch (error) {
      const aiError = this.handleError(error);
      throw new AIServiceError(
        `Failed to generate chapter: ${aiError.message}`,
        aiError.code,
        aiError.retryable
      );
    }
  }

  /**
   * Analyze content for context extraction
   */
  async analyzeContext(content: string): Promise<ContextAnalysis> {
    const prompt = this.buildContextAnalysisPrompt(content);

    try {
      const result = await this.executeWithRetry(async () => {
        return await this.model.generateContent(prompt);
      });

      const analysis = this.parseContextAnalysis(result.response.text());
      return analysis;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Check consistency between context and new content
   */
  async checkConsistency(
    context: ProjectContextForAI,
    newContent: string
  ): Promise<ConsistencyReport> {
    const prompt = this.buildConsistencyCheckPrompt(context, newContent);

    try {
      const result = await this.executeWithRetry(async () => {
        return await this.model.generateContent(prompt);
      });

      const report = this.parseConsistencyReport(result.response.text());
      return report;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Build the main chapter generation prompt with context injection
   */
  private buildChapterPrompt(request: ChapterGenerationRequest): string {
    const { projectContext, parameters, previousChapters } = request;

    let prompt = `You are a professional creative writing assistant specializing in ${projectContext.genre} fiction. Generate a chapter for a story with the following context:\n\n`;

    // Project context
    prompt += `**Project Summary:** ${projectContext.projectSummary}\n`;
    prompt += `**Genre:** ${projectContext.genre}\n`;
    prompt += `**Writing Style:** ${projectContext.writingStyle}\n\n`;

    // Characters context
    if (projectContext.characters && projectContext.characters.length > 0) {
      prompt += `**Characters:**\n`;
      projectContext.characters.forEach((char) => {
        prompt += `- ${char.name} (${char.role}): ${char.description}\n`;
        if (char.developmentArc) {
          prompt += `  Development Arc: ${char.developmentArc}\n`;
        }
      });
      prompt += '\n';
    }

    // Plot threads context
    if (projectContext.plotThreads && projectContext.plotThreads.length > 0) {
      prompt += `**Active Plot Threads:**\n`;
      projectContext.plotThreads.forEach((plot) => {
        prompt += `- ${plot.title} (${plot.status}): ${plot.description}\n`;
      });
      prompt += '\n';
    }

    // World building context
    const worldElements =
      projectContext.worldElements ||
      (projectContext as any).worldBuilding ||
      [];
    if (worldElements && worldElements.length > 0) {
      prompt += `**World Building:**\n`;
      worldElements.forEach((element: any) => {
        prompt += `- ${element.name} (${element.type}): ${element.description}\n`;
      });
      prompt += '\n';
    }

    // Timeline context
    if (
      projectContext.timelineEvents &&
      projectContext.timelineEvents.length > 0
    ) {
      prompt += `**Timeline Events:**\n`;
      projectContext.timelineEvents
        .sort((a, b) => a.importance - b.importance)
        .slice(0, 5) // Limit to most important events
        .forEach((event) => {
          prompt += `- ${event.eventDate}: ${event.title}\n`;
        });
      prompt += '\n';
    }

    // Previous chapters summary
    if (previousChapters.length > 0) {
      prompt += `**Previous Chapter Summary:**\n`;
      const lastChapter = previousChapters[previousChapters.length - 1];
      const summary = this.summarizeChapter(lastChapter);
      prompt += `${summary}\n\n`;
    }

    // Generation parameters
    prompt += `**Chapter Requirements:**\n`;
    prompt += `- Target length: ${parameters.length} words\n`;
    prompt += `- Tone: ${parameters.tone}\n`;
    prompt += `- Style: ${parameters.style}\n`;

    if (
      parameters.focusCharacters &&
      parameters.focusCharacters.length > 0 &&
      projectContext.characters
    ) {
      const focusChars = projectContext.characters
        .filter((char) => parameters.focusCharacters.includes(char.id))
        .map((char) => char.name);
      if (focusChars.length > 0) {
        prompt += `- Focus on characters: ${focusChars.join(', ')}\n`;
      }
    }

    if (
      parameters.plotPoints &&
      parameters.plotPoints.length > 0 &&
      projectContext.plotThreads
    ) {
      const focusPlots = projectContext.plotThreads
        .filter((plot) => parameters.plotPoints.includes(plot.id))
        .map((plot) => plot.title);
      if (focusPlots.length > 0) {
        prompt += `- Advance plot threads: ${focusPlots.join(', ')}\n`;
      }
    }

    // User's specific prompt
    prompt += `\n**Specific Instructions:**\n${request.prompt}\n\n`;

    // Final instructions
    prompt += `Please generate a compelling chapter that:\n`;
    prompt += `1. Maintains consistency with established characters and world-building\n`;
    prompt += `2. Advances the plot meaningfully\n`;
    prompt += `3. Matches the specified tone and style\n`;
    prompt += `4. Is approximately ${parameters.length} words long\n`;
    prompt += `5. Ends with a hook or transition that leads naturally to the next chapter\n\n`;
    prompt += `Generate only the chapter content without any meta-commentary or explanations.`;

    return prompt;
  }

  /**
   * Build prompt for context analysis
   */
  private buildContextAnalysisPrompt(content: string): string {
    return `Analyze the following text and extract key story elements. Return your analysis in JSON format with the following structure:

{
  "characters": ["character names mentioned"],
  "locations": ["locations, places, or settings mentioned"],
  "plotPoints": ["plot developments or events"],
  "themes": ["themes or motifs identified"],
  "inconsistencies": [{"type": "character|plot|world|timeline", "description": "issue description", "severity": "low|medium|high"}],
  "suggestions": ["improvement suggestions"]
}

Text to analyze:
${content}`;
  }

  /**
   * Build prompt for consistency checking
   */
  private buildConsistencyCheckPrompt(
    context: ProjectContextForAI,
    newContent: string
  ): string {
    let prompt = `Check the consistency of the following new content against the established story context. Look for contradictions in character behavior, plot continuity, world-building rules, and timeline.\n\n`;

    prompt += `**Established Context:**\n`;
    prompt += `Characters: ${context.characters.map((c) => `${c.name} - ${c.description}`).join('; ')}\n`;
    prompt += `Plot Threads: ${context.plotThreads.map((p) => `${p.title} - ${p.description}`).join('; ')}\n`;
    const worldElements =
      context.worldElements || (context as any).worldBuilding || [];
    prompt += `World Elements: ${worldElements.map((w: any) => `${w.name} - ${w.description}`).join('; ')}\n\n`;

    prompt += `**New Content to Check:**\n${newContent}\n\n`;

    prompt += `Return your analysis in JSON format:
{
  "issues": [{"type": "character|plot|world|timeline", "description": "issue description", "severity": "low|medium|high", "suggestedFix": "optional fix"}],
  "score": 85,
  "recommendations": ["general recommendations"]
}`;

    return prompt;
  }

  /**
   * Execute a function with retry logic and error handling
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await Promise.race([
          fn(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error('Request timeout')),
              this.config.timeout
            )
          ),
        ]);
      } catch (error) {
        lastError = error as Error;

        // Convert to AIServiceError first
        const aiError = this.handleError(error);

        // Don't retry on non-retryable errors
        if (!aiError.retryable) {
          throw aiError;
        }

        // Don't retry on the last attempt
        if (attempt === this.config.maxRetries) {
          throw aiError;
        }

        // Wait before retrying
        await new Promise((resolve) =>
          setTimeout(resolve, this.config.retryDelay * attempt)
        );
      }
    }

    throw this.handleError(lastError!);
  }

  /**
   * Handle and classify errors from the Gemini API
   */
  private handleError(error: unknown): AIServiceError {
    if (!error) {
      return new AIServiceError(
        'Unknown error occurred',
        'UNKNOWN_ERROR',
        false
      );
    }

    const message =
      (error as Error)?.message ||
      (typeof error === 'string' ? error : error?.toString()) ||
      'Unknown AI service error';

    // Rate limiting
    if (
      message.toLowerCase().includes('rate limit') ||
      message.includes('429')
    ) {
      return new AIRateLimitError(
        'Rate limit exceeded. Please try again later.'
      );
    }

    // Quota exceeded
    if (
      message.toLowerCase().includes('quota') ||
      message.toLowerCase().includes('billing')
    ) {
      return new AIQuotaExceededError(
        'API quota exceeded. Please check your billing.'
      );
    }

    // Content filtering
    if (
      message.toLowerCase().includes('safety') ||
      message.toLowerCase().includes('content policy')
    ) {
      return new AIContentFilterError(
        'Content was filtered due to safety policies.'
      );
    }

    // Network or timeout errors (retryable)
    if (
      message.toLowerCase().includes('timeout') ||
      message.toLowerCase().includes('network') ||
      message.includes('ECONNRESET')
    ) {
      return new AIServiceError(
        'Network error occurred.',
        'NETWORK_ERROR',
        true
      );
    }

    // Generic error - make it retryable by default unless it's clearly non-retryable
    const isRetryable =
      !message.toLowerCase().includes('invalid') &&
      !message.toLowerCase().includes('unauthorized');
    return new AIServiceError(message, 'UNKNOWN_ERROR', isRetryable);
  }

  /**
   * Utility methods
   */
  private countWords(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  private extractContextIds(context: ProjectContextForAI): string[] {
    const worldElements =
      context.worldElements || (context as any).worldBuilding || [];
    return [
      ...(context.characters || []).map((c) => c.id),
      ...(context.plotThreads || []).map((p) => p.id),
      ...worldElements.map((w: any) => w.id),
    ];
  }

  private extractSuggestions(content: string): string[] {
    // Simple heuristic-based suggestions
    const suggestions: string[] = [];

    if (content.length < 500) {
      suggestions.push(
        'Consider expanding the chapter with more descriptive details.'
      );
    }

    if (!content.includes('"') && !content.includes("'")) {
      suggestions.push(
        'Consider adding dialogue to make the chapter more engaging.'
      );
    }

    return suggestions;
  }

  private summarizeChapter(chapter: string): string {
    // Simple summarization - take first and last sentences
    const sentences = chapter
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);
    if (sentences.length <= 2) return chapter;

    return `${sentences[0].trim()}... ${sentences[sentences.length - 1].trim()}.`;
  }

  private parseContextAnalysis(response: string): ContextAnalysis {
    try {
      const parsed = JSON.parse(response);
      return {
        characters: parsed.characters || parsed.extractedCharacters || [],
        locations: parsed.locations || parsed.extractedWorldElements || [],
        plotPoints: parsed.plotPoints || parsed.extractedPlotPoints || [],
        themes: parsed.themes || [],
        inconsistencies: parsed.inconsistencies || [],
        suggestions: parsed.suggestions || [],
      };
    } catch {
      // Fallback if JSON parsing fails
      return {
        characters: [],
        locations: [],
        plotPoints: [],
        themes: [],
      };
    }
  }

  private parseConsistencyReport(response: string): ConsistencyReport {
    try {
      const parsed = JSON.parse(response);
      return {
        issues: parsed.issues || [],
        score: parsed.score || 50,
        recommendations: parsed.recommendations || [],
      };
    } catch {
      // Fallback if JSON parsing fails
      return {
        issues: [],
        score: 50,
        recommendations: ['Unable to parse consistency report'],
      };
    }
  }
}

// Export a default instance factory
export const createAIService = (config?: Partial<AIServiceConfig>) =>
  new AIService(config);
