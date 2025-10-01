#!/usr/bin/env python3
"""
LoRA Fine-Tuning Script for Llama Models

This script fine-tunes a Llama model using LoRA (Low-Rank Adaptation)
on email data to learn a user's writing voice.

LoRA is efficient and recommended for fine-tuning on consumer hardware:
- Uses ~50% less memory than full fine-tuning
- Faster training
- Smaller output models (adapters only)
- Easy to swap between different user voices

Usage:
    python finetune-lora.py --config configs/lora-config.yaml

Requirements:
    pip install torch transformers peft accelerate bitsandbytes datasets

Hardware Requirements:
    - Minimum: 24GB GPU VRAM (for Llama 3.1 8B)
    - Recommended: 48GB GPU VRAM (for Llama 3.3 70B with quantization)
    - CPU fallback possible but very slow

Author: EmailAI Team
License: MIT
"""

import argparse
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
import yaml

try:
    import torch
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        TrainingArguments,
        Trainer,
        DataCollatorForLanguageModeling,
    )
    from peft import (
        LoraConfig,
        get_peft_model,
        prepare_model_for_kbit_training,
        TaskType,
    )
    from datasets import load_dataset
    import bitsandbytes as bnb
except ImportError as e:
    print(f"❌ Error: Required package not installed: {e}")
    print("\nInstall requirements:")
    print("  pip install torch transformers peft accelerate bitsandbytes datasets")
    sys.exit(1)


@dataclass
class FineTuningConfig:
    """Fine-tuning configuration."""

    # Model
    base_model: str = "meta-llama/Llama-3.1-8B-Instruct"
    model_max_length: int = 2048

    # Data
    train_data: str = "training-data/train_alpaca.jsonl"
    val_data: str = "training-data/val_alpaca.jsonl"
    data_format: str = "alpaca"  # alpaca or chat

    # LoRA
    lora_r: int = 16  # Rank
    lora_alpha: int = 32  # Alpha scaling
    lora_dropout: float = 0.05
    lora_target_modules: list = None  # Will use default

    # Quantization
    use_4bit: bool = True  # Use 4-bit quantization (saves memory)
    bnb_4bit_compute_dtype: str = "float16"
    bnb_4bit_quant_type: str = "nf4"

    # Training
    output_dir: str = "./output"
    num_train_epochs: int = 3
    per_device_train_batch_size: int = 4
    per_device_eval_batch_size: int = 4
    gradient_accumulation_steps: int = 4
    learning_rate: float = 2e-4
    max_grad_norm: float = 0.3
    warmup_ratio: float = 0.03
    lr_scheduler_type: str = "cosine"

    # Logging
    logging_steps: int = 10
    save_steps: int = 100
    eval_steps: int = 100
    save_total_limit: int = 3

    # Other
    fp16: bool = False
    bf16: bool = True
    gradient_checkpointing: bool = True
    group_by_length: bool = True

    @classmethod
    def from_yaml(cls, yaml_file: str):
        """Load config from YAML file."""
        with open(yaml_file, 'r') as f:
            config_dict = yaml.safe_load(f)
        return cls(**config_dict)


class LoRAFineTuner:
    """Handles LoRA fine-tuning for Llama models."""

    def __init__(self, config: FineTuningConfig):
        """
        Initialize the fine-tuner.

        Args:
            config: Fine-tuning configuration
        """
        self.config = config
        self.model = None
        self.tokenizer = None
        self.train_dataset = None
        self.val_dataset = None

    def load_model(self):
        """Load and prepare the base model."""
        print(f"Loading base model: {self.config.base_model}")

        # Configure quantization
        if self.config.use_4bit:
            from transformers import BitsAndBytesConfig

            bnb_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_quant_type=self.config.bnb_4bit_quant_type,
                bnb_4bit_compute_dtype=getattr(
                    torch, self.config.bnb_4bit_compute_dtype
                ),
                bnb_4bit_use_double_quant=True,
            )

            model = AutoModelForCausalLM.from_pretrained(
                self.config.base_model,
                quantization_config=bnb_config,
                device_map="auto",
                trust_remote_code=True,
            )
        else:
            model = AutoModelForCausalLM.from_pretrained(
                self.config.base_model,
                device_map="auto",
                trust_remote_code=True,
                torch_dtype=torch.float16,
            )

        # Prepare model for k-bit training
        model = prepare_model_for_kbit_training(model)

        print("✅ Base model loaded")
        self.model = model

    def load_tokenizer(self):
        """Load tokenizer."""
        print(f"Loading tokenizer: {self.config.base_model}")

        tokenizer = AutoTokenizer.from_pretrained(
            self.config.base_model,
            trust_remote_code=True,
        )

        # Set padding token
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token

        tokenizer.padding_side = "right"
        tokenizer.model_max_length = self.config.model_max_length

        print("✅ Tokenizer loaded")
        self.tokenizer = tokenizer

    def setup_lora(self):
        """Configure and apply LoRA."""
        print("Setting up LoRA configuration...")

        # Default target modules for Llama
        if self.config.lora_target_modules is None:
            target_modules = [
                "q_proj",
                "k_proj",
                "v_proj",
                "o_proj",
                "gate_proj",
                "up_proj",
                "down_proj",
            ]
        else:
            target_modules = self.config.lora_target_modules

        lora_config = LoraConfig(
            r=self.config.lora_r,
            lora_alpha=self.config.lora_alpha,
            target_modules=target_modules,
            lora_dropout=self.config.lora_dropout,
            bias="none",
            task_type=TaskType.CAUSAL_LM,
        )

        # Apply LoRA
        self.model = get_peft_model(self.model, lora_config)

        # Print trainable parameters
        self.model.print_trainable_parameters()

        print("✅ LoRA configured")

    def load_dataset(self):
        """Load and preprocess training data."""
        print(f"Loading datasets...")
        print(f"  Train: {self.config.train_data}")
        print(f"  Val: {self.config.val_data}")

        # Load datasets
        train_dataset = load_dataset('json', data_files=self.config.train_data)['train']
        val_dataset = load_dataset('json', data_files=self.config.val_data)['train']

        # Preprocess function
        def preprocess_function(examples):
            if self.config.data_format == "alpaca":
                # Alpaca format: instruction + input + output
                prompts = []
                for i in range(len(examples['instruction'])):
                    instruction = examples['instruction'][i]
                    input_text = examples.get('input', [''] * len(examples['instruction']))[i]
                    output = examples['output'][i]

                    if input_text:
                        prompt = f"""### Instruction:
{instruction}

### Input:
{input_text}

### Response:
{output}"""
                    else:
                        prompt = f"""### Instruction:
{instruction}

### Response:
{output}"""

                    prompts.append(prompt)

            elif self.config.data_format == "chat":
                # Chat format: messages array
                prompts = []
                for messages in examples['messages']:
                    # Format as chat template
                    prompt = self.tokenizer.apply_chat_template(
                        messages,
                        tokenize=False,
                        add_generation_prompt=False
                    )
                    prompts.append(prompt)
            else:
                raise ValueError(f"Unknown data format: {self.config.data_format}")

            # Tokenize
            tokenized = self.tokenizer(
                prompts,
                padding="max_length",
                truncation=True,
                max_length=self.config.model_max_length,
                return_tensors="pt",
            )

            # Labels = input_ids for causal LM
            tokenized["labels"] = tokenized["input_ids"].clone()

            return tokenized

        # Apply preprocessing
        train_dataset = train_dataset.map(
            preprocess_function,
            batched=True,
            remove_columns=train_dataset.column_names,
        )

        val_dataset = val_dataset.map(
            preprocess_function,
            batched=True,
            remove_columns=val_dataset.column_names,
        )

        print(f"✅ Datasets loaded: {len(train_dataset)} train, {len(val_dataset)} val")

        self.train_dataset = train_dataset
        self.val_dataset = val_dataset

    def train(self):
        """Run the training."""
        print("Starting training...")

        # Training arguments
        training_args = TrainingArguments(
            output_dir=self.config.output_dir,
            num_train_epochs=self.config.num_train_epochs,
            per_device_train_batch_size=self.config.per_device_train_batch_size,
            per_device_eval_batch_size=self.config.per_device_eval_batch_size,
            gradient_accumulation_steps=self.config.gradient_accumulation_steps,
            learning_rate=self.config.learning_rate,
            max_grad_norm=self.config.max_grad_norm,
            warmup_ratio=self.config.warmup_ratio,
            lr_scheduler_type=self.config.lr_scheduler_type,
            logging_steps=self.config.logging_steps,
            save_steps=self.config.save_steps,
            eval_steps=self.config.eval_steps,
            eval_strategy="steps",
            save_strategy="steps",
            save_total_limit=self.config.save_total_limit,
            fp16=self.config.fp16,
            bf16=self.config.bf16,
            gradient_checkpointing=self.config.gradient_checkpointing,
            group_by_length=self.config.group_by_length,
            report_to="tensorboard",
            load_best_model_at_end=True,
            metric_for_best_model="eval_loss",
        )

        # Data collator
        data_collator = DataCollatorForLanguageModeling(
            tokenizer=self.tokenizer,
            mlm=False,
        )

        # Trainer
        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=self.train_dataset,
            eval_dataset=self.val_dataset,
            data_collator=data_collator,
        )

        # Train (with optional resume)
        resume_from_checkpoint = self.config.__dict__.get('resume_from_checkpoint')
        if resume_from_checkpoint:
            print(f"Resuming training from: {resume_from_checkpoint}")
            trainer.train(resume_from_checkpoint=resume_from_checkpoint)
        else:
            trainer.train()

        print("✅ Training complete")

        return trainer

    def save_model(self, output_dir: str):
        """Save the fine-tuned model."""
        print(f"Saving model to: {output_dir}")

        # Save LoRA adapters
        self.model.save_pretrained(output_dir)
        self.tokenizer.save_pretrained(output_dir)

        # Save config
        config_dict = {
            'base_model': self.config.base_model,
            'lora_r': self.config.lora_r,
            'lora_alpha': self.config.lora_alpha,
            'model_type': 'lora',
            'trained_on': 'email_data',
        }

        with open(Path(output_dir) / 'training_config.json', 'w') as f:
            json.dump(config_dict, f, indent=2)

        print("✅ Model saved")
        print(f"\nTo use this model with Ollama:")
        print(f"  1. Create a Modelfile pointing to these adapters")
        print(f"  2. Or merge adapters with base model (see docs)")


def main():
    parser = argparse.ArgumentParser(
        description='Fine-tune Llama model with LoRA'
    )
    parser.add_argument(
        '--config',
        required=True,
        help='Path to config YAML file'
    )
    parser.add_argument(
        '--output',
        help='Override output directory'
    )
    parser.add_argument(
        '--resume-from-checkpoint',
        help='Resume training from checkpoint directory'
    )

    args = parser.parse_args()

    print("=" * 70)
    print("Llama LoRA Fine-Tuning for Email Voice")
    print("=" * 70)
    print()

    # Load config
    config = FineTuningConfig.from_yaml(args.config)

    if args.output:
        config.output_dir = args.output

    if args.resume_from_checkpoint:
        config.__dict__['resume_from_checkpoint'] = args.resume_from_checkpoint

    # Create output directory
    Path(config.output_dir).mkdir(parents=True, exist_ok=True)

    # Initialize fine-tuner
    finetuner = LoRAFineTuner(config)

    # Load model and tokenizer
    finetuner.load_tokenizer()
    finetuner.load_model()

    # Setup LoRA
    finetuner.setup_lora()

    # Load datasets
    finetuner.load_dataset()

    # Train
    trainer = finetuner.train()

    # Save
    finetuner.save_model(config.output_dir)

    print()
    print("=" * 70)
    print("✅ Fine-tuning complete!")
    print("=" * 70)
    print()
    print("Output files:")
    print(f"  Model adapters: {config.output_dir}/")
    print(f"  Training logs: {config.output_dir}/runs/")
    print()
    print("Next steps:")
    print("  1. Evaluate the model")
    print("  2. Merge LoRA adapters with base model (optional)")
    print("  3. Deploy to Ollama")
    print("  4. See: fine-tuning/docs/FINE_TUNING_GUIDE.md")
    print()


if __name__ == '__main__':
    main()
