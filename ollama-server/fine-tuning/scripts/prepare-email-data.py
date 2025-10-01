#!/usr/bin/env python3
"""
Email Data Preparation for Llama Fine-Tuning

This script prepares email data from EmailAI database for fine-tuning
a Llama model to write emails in a user's voice.

It extracts sent emails and formats them into training datasets for:
- LoRA fine-tuning (recommended)
- Full fine-tuning (advanced)

Usage:
    python prepare-email-data.py --user-id <user-id> --output <output-dir>

Requirements:
    pip install psycopg2-binary jsonlines transformers

Author: EmailAI Team
License: MIT
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
import re

try:
    import psycopg2
    import jsonlines
except ImportError:
    print("Error: Required packages not installed.")
    print("Run: pip install psycopg2-binary jsonlines")
    sys.exit(1)


class EmailDataPreparer:
    """Prepares email data for fine-tuning Llama models."""

    def __init__(self, db_url: str, user_id: str, min_emails: int = 50):
        """
        Initialize the data preparer.

        Args:
            db_url: PostgreSQL database URL
            user_id: EmailAI user ID
            min_emails: Minimum number of sent emails required
        """
        self.db_url = db_url
        self.user_id = user_id
        self.min_emails = min_emails
        self.conn = None

    def connect(self):
        """Connect to database."""
        try:
            self.conn = psycopg2.connect(self.db_url)
            print(f"✅ Connected to database")
        except Exception as e:
            print(f"❌ Database connection failed: {e}")
            sys.exit(1)

    def close(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()

    def fetch_sent_emails(self) -> List[Dict]:
        """
        Fetch sent emails from the user's email accounts.

        Returns:
            List of email dictionaries with from, to, subject, body
        """
        cursor = self.conn.cursor()

        # Query to get sent emails
        # Adjust this query based on your actual database schema
        query = """
            SELECT
                e.id,
                e.subject,
                e.text_plain,
                e.text_html,
                e.snippet,
                e.sent_at,
                e.from_email,
                e.to_email
            FROM "ExecutedRule" er
            JOIN "Rule" r ON er."ruleId" = r.id
            JOIN "EmailAccount" ea ON r."userId" = ea."userId"
            LEFT JOIN "Email" e ON er."threadId" = e."threadId"
            WHERE ea."userId" = %s
                AND er.actions::text LIKE '%SEND_EMAIL%'
                AND e.text_plain IS NOT NULL
                AND LENGTH(e.text_plain) > 50
            ORDER BY e.sent_at DESC
            LIMIT 500
        """

        try:
            cursor.execute(query, (self.user_id,))
            rows = cursor.fetchall()

            emails = []
            for row in rows:
                email = {
                    'id': row[0],
                    'subject': row[1],
                    'text_plain': row[2],
                    'text_html': row[3],
                    'snippet': row[4],
                    'sent_at': row[5],
                    'from_email': row[6],
                    'to_email': row[7],
                }
                emails.append(email)

            cursor.close()
            print(f"✅ Fetched {len(emails)} sent emails")
            return emails

        except Exception as e:
            print(f"❌ Error fetching emails: {e}")
            cursor.close()
            return []

    def clean_email_text(self, text: str) -> str:
        """
        Clean email text for training.

        Args:
            text: Raw email text

        Returns:
            Cleaned text
        """
        if not text:
            return ""

        # Remove email signatures (common patterns)
        text = re.sub(r'\n--\s*\n.*', '', text, flags=re.DOTALL)
        text = re.sub(r'\nSent from my .*', '', text)
        text = re.sub(r'\nBest regards.*', '', text, flags=re.DOTALL)
        text = re.sub(r'\nThanks,.*', '', text, flags=re.DOTALL)

        # Remove excessive whitespace
        text = re.sub(r'\n\n+', '\n\n', text)
        text = text.strip()

        # Remove very short responses (likely not useful)
        if len(text) < 50:
            return ""

        return text

    def extract_context(self, email: Dict) -> Optional[str]:
        """
        Extract context from email (what the user is responding to).

        Args:
            email: Email dictionary

        Returns:
            Context string or None
        """
        # This is a simplified version
        # In production, you'd want to fetch the actual email thread
        # and extract the previous message
        subject = email.get('subject', '')

        # Check if it's a reply
        if subject.startswith('Re: ') or subject.startswith('RE: '):
            return f"Previous email subject: {subject[4:]}"

        return None

    def create_training_examples(self, emails: List[Dict]) -> List[Dict]:
        """
        Create training examples in Llama format.

        Args:
            emails: List of email dictionaries

        Returns:
            List of training examples
        """
        examples = []

        for email in emails:
            # Clean the email text
            text = self.clean_email_text(email.get('text_plain', ''))
            if not text:
                continue

            subject = email.get('subject', '')
            context = self.extract_context(email)

            # Create instruction-based training example
            # This format works well for Llama models
            if context:
                instruction = f"Write a professional email reply about: {subject}\n\nContext: {context}"
            else:
                instruction = f"Write a professional email about: {subject}"

            example = {
                "instruction": instruction,
                "input": "",
                "output": text,
                "metadata": {
                    "email_id": email.get('id'),
                    "subject": subject,
                    "sent_at": str(email.get('sent_at', '')),
                    "from": email.get('from_email'),
                    "to": email.get('to_email'),
                }
            }

            examples.append(example)

        print(f"✅ Created {len(examples)} training examples")
        return examples

    def create_alpaca_format(self, examples: List[Dict]) -> List[Dict]:
        """
        Convert examples to Alpaca format for training.

        Args:
            examples: Training examples

        Returns:
            Alpaca-formatted examples
        """
        alpaca_examples = []

        for ex in examples:
            alpaca_ex = {
                "instruction": ex["instruction"],
                "input": ex["input"],
                "output": ex["output"]
            }
            alpaca_examples.append(alpaca_ex)

        return alpaca_examples

    def create_chat_format(self, examples: List[Dict]) -> List[Dict]:
        """
        Convert examples to chat format for Llama fine-tuning.

        Args:
            examples: Training examples

        Returns:
            Chat-formatted examples
        """
        chat_examples = []

        for ex in examples:
            # Llama chat format
            messages = [
                {
                    "role": "system",
                    "content": "You are a helpful email assistant. Write emails in a professional, clear, and concise manner matching the user's writing style."
                },
                {
                    "role": "user",
                    "content": ex["instruction"]
                },
                {
                    "role": "assistant",
                    "content": ex["output"]
                }
            ]

            chat_examples.append({"messages": messages})

        return chat_examples

    def split_dataset(
        self,
        examples: List[Dict],
        train_ratio: float = 0.9
    ) -> tuple[List[Dict], List[Dict]]:
        """
        Split dataset into train and validation sets.

        Args:
            examples: All examples
            train_ratio: Ratio of training data (default 0.9)

        Returns:
            Tuple of (train_examples, val_examples)
        """
        import random
        random.shuffle(examples)

        split_idx = int(len(examples) * train_ratio)
        train = examples[:split_idx]
        val = examples[split_idx:]

        print(f"✅ Split: {len(train)} training, {len(val)} validation")
        return train, val

    def save_dataset(
        self,
        examples: List[Dict],
        output_dir: Path,
        format: str = "alpaca"
    ):
        """
        Save dataset to files.

        Args:
            examples: Training examples
            output_dir: Output directory
            format: Format (alpaca or chat)
        """
        output_dir.mkdir(parents=True, exist_ok=True)

        # Convert to desired format
        if format == "alpaca":
            formatted = self.create_alpaca_format(examples)
        elif format == "chat":
            formatted = self.create_chat_format(examples)
        else:
            formatted = examples

        # Split into train/val
        train, val = self.split_dataset(formatted)

        # Save as JSONL (one JSON per line)
        train_file = output_dir / f"train_{format}.jsonl"
        val_file = output_dir / f"val_{format}.jsonl"

        with jsonlines.open(train_file, mode='w') as writer:
            writer.write_all(train)

        with jsonlines.open(val_file, mode='w') as writer:
            writer.write_all(val)

        print(f"✅ Saved training data to {train_file}")
        print(f"✅ Saved validation data to {val_file}")

        # Also save as single JSON for reference
        json_file = output_dir / f"dataset_{format}.json"
        with open(json_file, 'w') as f:
            json.dump({
                'train': train,
                'val': val,
                'metadata': {
                    'user_id': self.user_id,
                    'total_examples': len(formatted),
                    'train_examples': len(train),
                    'val_examples': len(val),
                    'format': format,
                    'created_at': datetime.now().isoformat()
                }
            }, f, indent=2)

        print(f"✅ Saved combined dataset to {json_file}")

    def create_statistics(self, examples: List[Dict]) -> Dict:
        """
        Create statistics about the dataset.

        Args:
            examples: Training examples

        Returns:
            Statistics dictionary
        """
        if not examples:
            return {}

        total = len(examples)
        avg_length = sum(len(ex['output']) for ex in examples) / total
        min_length = min(len(ex['output']) for ex in examples)
        max_length = max(len(ex['output']) for ex in examples)

        # Count subject patterns
        subjects = [ex['metadata']['subject'] for ex in examples]
        reply_count = sum(1 for s in subjects if s.startswith(('Re:', 'RE:')))
        forward_count = sum(1 for s in subjects if s.startswith(('Fwd:', 'FW:')))

        stats = {
            'total_examples': total,
            'avg_email_length': int(avg_length),
            'min_email_length': min_length,
            'max_email_length': max_length,
            'reply_emails': reply_count,
            'forward_emails': forward_count,
            'new_emails': total - reply_count - forward_count,
        }

        return stats


def main():
    parser = argparse.ArgumentParser(
        description='Prepare email data for Llama fine-tuning'
    )
    parser.add_argument(
        '--db-url',
        required=True,
        help='PostgreSQL database URL'
    )
    parser.add_argument(
        '--user-id',
        required=True,
        help='EmailAI user ID'
    )
    parser.add_argument(
        '--output',
        default='./training-data',
        help='Output directory for training data'
    )
    parser.add_argument(
        '--min-emails',
        type=int,
        default=50,
        help='Minimum number of emails required'
    )
    parser.add_argument(
        '--format',
        choices=['alpaca', 'chat', 'both'],
        default='both',
        help='Output format'
    )

    args = parser.parse_args()

    print("=" * 60)
    print("Email Data Preparation for Llama Fine-Tuning")
    print("=" * 60)
    print(f"User ID: {args.user_id}")
    print(f"Output: {args.output}")
    print(f"Min emails: {args.min_emails}")
    print("=" * 60)
    print()

    # Initialize preparer
    preparer = EmailDataPreparer(
        db_url=args.db_url,
        user_id=args.user_id,
        min_emails=args.min_emails
    )

    # Connect to database
    preparer.connect()

    try:
        # Fetch emails
        emails = preparer.fetch_sent_emails()

        if len(emails) < args.min_emails:
            print(f"❌ Not enough emails: {len(emails)} < {args.min_emails}")
            print(f"   User needs to send more emails before fine-tuning")
            sys.exit(1)

        # Create training examples
        examples = preparer.create_training_examples(emails)

        if not examples:
            print("❌ No valid training examples created")
            sys.exit(1)

        # Create statistics
        stats = preparer.create_statistics(examples)
        print()
        print("Dataset Statistics:")
        print("-" * 60)
        for key, value in stats.items():
            print(f"  {key}: {value}")
        print("-" * 60)
        print()

        # Save dataset
        output_dir = Path(args.output)

        if args.format in ['alpaca', 'both']:
            preparer.save_dataset(examples, output_dir, format='alpaca')

        if args.format in ['chat', 'both']:
            preparer.save_dataset(examples, output_dir, format='chat')

        print()
        print("=" * 60)
        print("✅ Data preparation complete!")
        print("=" * 60)
        print()
        print("Next steps:")
        print(f"  1. Review the data in: {output_dir}")
        print(f"  2. Run fine-tuning script with this data")
        print(f"  3. See: fine-tuning/docs/FINE_TUNING_GUIDE.md")
        print()

    finally:
        preparer.close()


if __name__ == '__main__':
    main()
