#!/usr/bin/env python3
"""
Model Evaluation Script

Tests a fine-tuned Llama model on email generation tasks
to evaluate if it learned the user's writing voice.

Usage:
    python evaluate-model.py --model ./output/llama-3.1-8b-email --test-data test-prompts.json

Author: EmailAI Team
License: MIT
"""

import argparse
import json
from pathlib import Path
from typing import List, Dict
import sys

try:
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import PeftModel
except ImportError:
    print("❌ Error: Required packages not installed")
    print("Run: pip install -r configs/requirements.txt")
    sys.exit(1)


class ModelEvaluator:
    """Evaluates fine-tuned models."""

    def __init__(
        self,
        model_path: str,
        base_model: str = None,
        use_4bit: bool = False
    ):
        """
        Initialize evaluator.

        Args:
            model_path: Path to fine-tuned model (LoRA adapters)
            base_model: Base model name (auto-detected if None)
            use_4bit: Use 4-bit quantization
        """
        self.model_path = model_path
        self.use_4bit = use_4bit

        # Try to load config
        config_path = Path(model_path) / "training_config.json"
        if config_path.exists():
            with open(config_path) as f:
                config = json.load(f)
                self.base_model = config.get('base_model')
        else:
            self.base_model = base_model

        if not self.base_model:
            print("❌ Base model not found. Specify with --base-model")
            sys.exit(1)

        self.model = None
        self.tokenizer = None

    def load_model(self):
        """Load the fine-tuned model."""
        print(f"Loading base model: {self.base_model}")
        print(f"Loading adapters from: {self.model_path}")

        # Load tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(
            self.base_model,
            trust_remote_code=True
        )

        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        # Load base model
        if self.use_4bit:
            from transformers import BitsAndBytesConfig

            bnb_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_compute_dtype=torch.float16,
            )

            base_model = AutoModelForCausalLM.from_pretrained(
                self.base_model,
                quantization_config=bnb_config,
                device_map="auto",
                trust_remote_code=True,
            )
        else:
            base_model = AutoModelForCausalLM.from_pretrained(
                self.base_model,
                device_map="auto",
                torch_dtype=torch.float16,
                trust_remote_code=True,
            )

        # Load LoRA adapters
        self.model = PeftModel.from_pretrained(
            base_model,
            self.model_path,
            device_map="auto"
        )

        # Set to eval mode
        self.model.eval()

        print("✅ Model loaded")

    def generate(
        self,
        prompt: str,
        max_new_tokens: int = 512,
        temperature: float = 0.7,
        top_p: float = 0.9,
    ) -> str:
        """
        Generate text from prompt.

        Args:
            prompt: Input prompt
            max_new_tokens: Max tokens to generate
            temperature: Sampling temperature
            top_p: Nucleus sampling parameter

        Returns:
            Generated text
        """
        # Format prompt (Alpaca style)
        formatted_prompt = f"""### Instruction:
{prompt}

### Response:
"""

        # Tokenize
        inputs = self.tokenizer(
            formatted_prompt,
            return_tensors="pt",
            truncation=True,
            max_length=2048
        ).to(self.model.device)

        # Generate
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                temperature=temperature,
                top_p=top_p,
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id,
            )

        # Decode
        generated_text = self.tokenizer.decode(
            outputs[0],
            skip_special_tokens=True
        )

        # Extract response (after "### Response:")
        if "### Response:" in generated_text:
            response = generated_text.split("### Response:")[1].strip()
        else:
            response = generated_text

        return response

    def evaluate_prompts(self, test_prompts: List[Dict]):
        """
        Evaluate model on test prompts.

        Args:
            test_prompts: List of test prompt dictionaries
        """
        print(f"\nEvaluating {len(test_prompts)} test prompts...")
        print("=" * 70)

        results = []

        for i, prompt_data in enumerate(test_prompts, 1):
            prompt = prompt_data.get('prompt', '')
            expected = prompt_data.get('expected', None)

            print(f"\n[{i}/{len(test_prompts)}] Prompt:")
            print(f"  {prompt[:100]}...")
            print()

            # Generate
            response = self.generate(prompt)

            print("Generated Response:")
            print("-" * 70)
            print(response)
            print("-" * 70)

            if expected:
                print("\nExpected Response:")
                print("-" * 70)
                print(expected)
                print("-" * 70)

            # Save result
            results.append({
                'prompt': prompt,
                'generated': response,
                'expected': expected,
            })

            print()

        return results

    def save_results(self, results: List[Dict], output_file: str):
        """Save evaluation results."""
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2)

        print(f"\n✅ Results saved to: {output_file}")


def load_test_prompts(file_path: str) -> List[Dict]:
    """Load test prompts from JSON file."""
    with open(file_path) as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(
        description='Evaluate fine-tuned Llama model'
    )
    parser.add_argument(
        '--model',
        required=True,
        help='Path to fine-tuned model directory'
    )
    parser.add_argument(
        '--base-model',
        help='Base model name (auto-detected from config if not provided)'
    )
    parser.add_argument(
        '--test-data',
        required=True,
        help='Path to test prompts JSON file'
    )
    parser.add_argument(
        '--output',
        default='evaluation-results.json',
        help='Output file for results'
    )
    parser.add_argument(
        '--use-4bit',
        action='store_true',
        help='Use 4-bit quantization'
    )
    parser.add_argument(
        '--max-tokens',
        type=int,
        default=512,
        help='Max tokens to generate'
    )
    parser.add_argument(
        '--temperature',
        type=float,
        default=0.7,
        help='Sampling temperature'
    )

    args = parser.parse_args()

    print("=" * 70)
    print("Model Evaluation")
    print("=" * 70)
    print()

    # Initialize evaluator
    evaluator = ModelEvaluator(
        model_path=args.model,
        base_model=args.base_model,
        use_4bit=args.use_4bit
    )

    # Load model
    evaluator.load_model()

    # Load test prompts
    test_prompts = load_test_prompts(args.test_data)
    print(f"Loaded {len(test_prompts)} test prompts")

    # Evaluate
    results = evaluator.evaluate_prompts(test_prompts)

    # Save results
    evaluator.save_results(results, args.output)

    print()
    print("=" * 70)
    print("✅ Evaluation complete!")
    print("=" * 70)


if __name__ == '__main__':
    main()
