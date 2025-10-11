/**
 * Training Data Formatter
 *
 * Formats email data into the appropriate format for LoRA fine-tuning.
 * Supports various training formats including instruction-following and completion.
 */

import type { TrainingEmail, TrainingDataset } from "./email-data-extractor";
import { createScopedLogger } from "@/utils/logger";

const logger = createScopedLogger("training-data-formatter");

/**
 * Training example in instruction format (for chat/instruct models)
 */
export interface InstructionExample {
  instruction: string;
  input?: string;
  output: string;
}

/**
 * Training example in chat format
 */
export interface ChatExample {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
}

/**
 * Formatted training data ready for LoRA training
 */
export interface FormattedTrainingData {
  examples: (InstructionExample | ChatExample)[];
  format: "instruction" | "chat";
  metadata: {
    totalExamples: number;
    userId: string;
    formattedAt: Date;
  };
}

export class TrainingDataFormatter {
  /**
   * Format emails as instruction-following examples
   * Format: User provides context, model generates email
   */
  static formatAsInstructions(
    dataset: TrainingDataset
  ): FormattedTrainingData {
    logger.info("Formatting training data as instructions", {
      userId: dataset.userId,
      emailCount: dataset.emails.length,
    });

    const examples: InstructionExample[] = dataset.emails.map((email) => ({
      instruction: "Write a professional email based on the following context:",
      input: `To: ${email.to}\nSubject: [Email response]`,
      output: email.content || `[Email sent to ${email.to}]`,
    }));

    return {
      examples,
      format: "instruction",
      metadata: {
        totalExamples: examples.length,
        userId: dataset.userId,
        formattedAt: new Date(),
      },
    };
  }

  /**
   * Format emails as chat examples
   * Better for conversational models like Llama
   */
  static formatAsChat(dataset: TrainingDataset): FormattedTrainingData {
    logger.info("Formatting training data as chat", {
      userId: dataset.userId,
      emailCount: dataset.emails.length,
    });

    const examples: ChatExample[] = dataset.emails.map((email) => ({
      messages: [
        {
          role: "system",
          content:
            "You are an AI assistant helping to compose professional emails in the user's writing style.",
        },
        {
          role: "user",
          content: `Please write an email to ${email.to}.`,
        },
        {
          role: "assistant",
          content: email.content || `[Email sent to ${email.to}]`,
        },
      ],
    }));

    return {
      examples,
      format: "chat",
      metadata: {
        totalExamples: examples.length,
        userId: dataset.userId,
        formattedAt: new Date(),
      },
    };
  }

  /**
   * Convert formatted data to JSONL format for training
   * Each line is a JSON object
   */
  static toJSONL(formattedData: FormattedTrainingData): string {
    return formattedData.examples.map((ex) => JSON.stringify(ex)).join("\n");
  }

  /**
   * Convert formatted data to Alpaca format (popular for instruction tuning)
   */
  static toAlpacaFormat(formattedData: FormattedTrainingData): string {
    if (formattedData.format !== "instruction") {
      throw new Error("Alpaca format only supports instruction format");
    }

    return JSON.stringify(formattedData.examples, null, 2);
  }

  /**
   * Split data into train and validation sets
   */
  static splitTrainValidation(
    formattedData: FormattedTrainingData,
    validationRatio: number = 0.1
  ): {
    train: FormattedTrainingData;
    validation: FormattedTrainingData;
  } {
    const shuffled = [...formattedData.examples].sort(
      () => Math.random() - 0.5
    );
    const splitIndex = Math.floor(
      shuffled.length * (1 - validationRatio)
    );

    const trainExamples = shuffled.slice(0, splitIndex);
    const valExamples = shuffled.slice(splitIndex);

    logger.info("Split dataset", {
      total: formattedData.examples.length,
      train: trainExamples.length,
      validation: valExamples.length,
    });

    return {
      train: {
        ...formattedData,
        examples: trainExamples,
        metadata: {
          ...formattedData.metadata,
          totalExamples: trainExamples.length,
        },
      },
      validation: {
        ...formattedData,
        examples: valExamples,
        metadata: {
          ...formattedData.metadata,
          totalExamples: valExamples.length,
        },
      },
    };
  }

  /**
   * Get training data statistics
   */
  static getStats(formattedData: FormattedTrainingData) {
    const examples = formattedData.examples;

    // Calculate average content length
    let totalContentLength = 0;
    let minLength = Infinity;
    let maxLength = 0;

    examples.forEach((ex) => {
      let content = "";
      if ("output" in ex) {
        content = ex.output;
      } else if ("messages" in ex) {
        content = ex.messages
          .map((m) => m.content)
          .join(" ");
      }

      const length = content.length;
      totalContentLength += length;
      minLength = Math.min(minLength, length);
      maxLength = Math.max(maxLength, length);
    });

    const avgLength = totalContentLength / examples.length;

    return {
      totalExamples: examples.length,
      format: formattedData.format,
      contentStats: {
        avgLength: Math.round(avgLength),
        minLength: minLength === Infinity ? 0 : minLength,
        maxLength,
      },
      estimatedTrainingTime: this.estimateTrainingTime(examples.length),
    };
  }

  /**
   * Estimate training time based on dataset size
   * Rough estimates for reference
   */
  private static estimateTrainingTime(exampleCount: number): string {
    // Very rough estimate: ~1-2 seconds per example with LoRA on GPU
    const minutes = Math.ceil((exampleCount * 1.5) / 60);

    if (minutes < 60) {
      return `~${minutes} minutes`;
    }

    const hours = Math.ceil(minutes / 60);
    return `~${hours} hour${hours > 1 ? "s" : ""}`;
  }
}
