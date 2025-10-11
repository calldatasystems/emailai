/**
 * Training Data Validator
 *
 * Validates and performs quality checks on training data
 * to ensure it meets requirements for LoRA fine-tuning.
 */

import type {
  FormattedTrainingData,
  InstructionExample,
  ChatExample,
} from "./training-data-formatter";
import { createScopedLogger } from "@/utils/logger";

const logger = createScopedLogger("training-data-validator");

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalExamples: number;
    validExamples: number;
    invalidExamples: number;
    avgContentLength: number;
  };
}

export interface QualityMetrics {
  contentQuality: number; // 0-1 score
  diversity: number; // 0-1 score
  consistency: number; // 0-1 score
  overall: number; // 0-1 score
  issues: string[];
  recommendations: string[];
}

export class TrainingDataValidator {
  private static readonly MIN_EXAMPLES = 100;
  private static readonly MAX_EXAMPLES = 10000;
  private static readonly MIN_CONTENT_LENGTH = 10;
  private static readonly MAX_CONTENT_LENGTH = 4000;
  private static readonly RECOMMENDED_MIN_LENGTH = 50;

  /**
   * Validate training data meets basic requirements
   */
  static validate(data: FormattedTrainingData): ValidationResult {
    logger.info("Validating training data", {
      format: data.format,
      exampleCount: data.examples.length,
    });

    const errors: string[] = [];
    const warnings: string[] = [];
    let validExamples = 0;
    let totalContentLength = 0;

    // Check example count
    if (data.examples.length < this.MIN_EXAMPLES) {
      errors.push(
        `Insufficient examples: ${data.examples.length} (minimum: ${this.MIN_EXAMPLES})`
      );
    }

    if (data.examples.length > this.MAX_EXAMPLES) {
      warnings.push(
        `Very large dataset: ${data.examples.length} examples. Training may take a long time.`
      );
    }

    // Validate each example
    data.examples.forEach((example, index) => {
      const exampleErrors = this.validateExample(example, data.format);

      if (exampleErrors.length === 0) {
        validExamples++;

        // Calculate content length
        const content = this.extractContent(example);
        totalContentLength += content.length;

        // Check content length
        if (content.length < this.RECOMMENDED_MIN_LENGTH) {
          warnings.push(
            `Example ${index + 1}: Content is short (${content.length} chars). Longer examples generally produce better results.`
          );
        }
      } else {
        errors.push(...exampleErrors.map((e) => `Example ${index + 1}: ${e}`));
      }
    });

    const avgContentLength =
      validExamples > 0 ? totalContentLength / validExamples : 0;

    const result: ValidationResult = {
      isValid: errors.length === 0 && validExamples >= this.MIN_EXAMPLES,
      errors,
      warnings,
      stats: {
        totalExamples: data.examples.length,
        validExamples,
        invalidExamples: data.examples.length - validExamples,
        avgContentLength: Math.round(avgContentLength),
      },
    };

    logger.info("Validation complete", {
      isValid: result.isValid,
      errors: errors.length,
      warnings: warnings.length,
      validExamples,
    });

    return result;
  }

  /**
   * Validate a single training example
   */
  private static validateExample(
    example: InstructionExample | ChatExample,
    format: "instruction" | "chat"
  ): string[] {
    const errors: string[] = [];

    if (format === "instruction") {
      const inst = example as InstructionExample;

      if (!inst.instruction || inst.instruction.trim().length === 0) {
        errors.push("Missing or empty instruction");
      }

      if (!inst.output || inst.output.trim().length === 0) {
        errors.push("Missing or empty output");
      }

      const outputLength = inst.output?.length || 0;
      if (outputLength < this.MIN_CONTENT_LENGTH) {
        errors.push(
          `Output too short: ${outputLength} chars (minimum: ${this.MIN_CONTENT_LENGTH})`
        );
      }

      if (outputLength > this.MAX_CONTENT_LENGTH) {
        errors.push(
          `Output too long: ${outputLength} chars (maximum: ${this.MAX_CONTENT_LENGTH})`
        );
      }
    } else if (format === "chat") {
      const chat = example as ChatExample;

      if (!chat.messages || chat.messages.length === 0) {
        errors.push("Missing or empty messages array");
        return errors;
      }

      // Check for required roles
      const hasSystem = chat.messages.some((m) => m.role === "system");
      const hasUser = chat.messages.some((m) => m.role === "user");
      const hasAssistant = chat.messages.some((m) => m.role === "assistant");

      if (!hasAssistant) {
        errors.push("Missing assistant message");
      }

      if (!hasUser && !hasSystem) {
        errors.push("Missing user or system message");
      }

      // Validate each message
      chat.messages.forEach((msg, idx) => {
        if (!msg.content || msg.content.trim().length === 0) {
          errors.push(`Message ${idx + 1}: Empty content`);
        }

        if (!["system", "user", "assistant"].includes(msg.role)) {
          errors.push(`Message ${idx + 1}: Invalid role "${msg.role}"`);
        }
      });
    }

    return errors;
  }

  /**
   * Assess quality of training data
   */
  static assessQuality(data: FormattedTrainingData): QualityMetrics {
    logger.info("Assessing data quality", {
      exampleCount: data.examples.length,
    });

    const issues: string[] = [];
    const recommendations: string[] = [];

    // 1. Content Quality Score
    const contentQuality = this.assessContentQuality(data);
    if (contentQuality < 0.7) {
      issues.push("Content quality is below recommended threshold");
      recommendations.push(
        "Consider filtering out very short or low-quality emails"
      );
    }

    // 2. Diversity Score
    const diversity = this.assessDiversity(data);
    if (diversity < 0.6) {
      issues.push("Training data lacks diversity");
      recommendations.push(
        "Try to include emails from different time periods or topics"
      );
    }

    // 3. Consistency Score
    const consistency = this.assessConsistency(data);
    if (consistency < 0.7) {
      issues.push("Data formatting is inconsistent");
      recommendations.push("Ensure all examples follow the same format");
    }

    // Calculate overall score
    const overall = (contentQuality + diversity + consistency) / 3;

    const metrics: QualityMetrics = {
      contentQuality,
      diversity,
      consistency,
      overall,
      issues,
      recommendations,
    };

    logger.info("Quality assessment complete", {
      overall: overall.toFixed(2),
      issueCount: issues.length,
    });

    return metrics;
  }

  /**
   * Assess content quality (length, completeness)
   */
  private static assessContentQuality(data: FormattedTrainingData): number {
    let totalScore = 0;

    data.examples.forEach((example) => {
      const content = this.extractContent(example);
      const length = content.length;

      // Score based on length
      let lengthScore = 0;
      if (length >= 200) lengthScore = 1.0;
      else if (length >= 100) lengthScore = 0.8;
      else if (length >= 50) lengthScore = 0.6;
      else if (length >= 20) lengthScore = 0.4;
      else lengthScore = 0.2;

      totalScore += lengthScore;
    });

    return totalScore / data.examples.length;
  }

  /**
   * Assess diversity (variety in content)
   */
  private static assessDiversity(data: FormattedTrainingData): number {
    // Simple diversity check: measure unique words
    const allWords = new Set<string>();
    const contentLengths: number[] = [];

    data.examples.forEach((example) => {
      const content = this.extractContent(example);
      contentLengths.push(content.length);

      // Extract words (simple tokenization)
      const words = content.toLowerCase().match(/\b\w+\b/g) || [];
      words.forEach((word) => allWords.add(word));
    });

    // Calculate coefficient of variation for lengths
    const avgLength =
      contentLengths.reduce((a, b) => a + b, 0) / contentLengths.length;
    const variance =
      contentLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) /
      contentLengths.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / avgLength;

    // Diversity score based on unique words and length variation
    const uniqueWordRatio = allWords.size / (data.examples.length * 50); // Assume ~50 words per example
    const diversityScore = Math.min(1, (uniqueWordRatio + Math.min(cv, 0.5)) / 2);

    return diversityScore;
  }

  /**
   * Assess consistency (formatting, structure)
   */
  private static assessConsistency(data: FormattedTrainingData): number {
    let consistentCount = 0;

    data.examples.forEach((example) => {
      const errors = this.validateExample(example, data.format);
      if (errors.length === 0) {
        consistentCount++;
      }
    });

    return consistentCount / data.examples.length;
  }

  /**
   * Extract text content from an example
   */
  private static extractContent(
    example: InstructionExample | ChatExample
  ): string {
    if ("output" in example) {
      return example.output || "";
    } else if ("messages" in example) {
      return example.messages.map((m) => m.content).join(" ");
    }
    return "";
  }
}
