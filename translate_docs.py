#!/usr/bin/env python3
"""
Translate MDX documentation from English to Russian
Preserves frontmatter, code blocks, and MDX structure
Escapes { and } outside of code blocks
"""

import os
import re
import anthropic
from pathlib import Path
import time

# Initialize Anthropic client
client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

def translate_mdx_to_russian(content: str, file_path: str) -> str:
    """
    Translate MDX content to Russian using Claude
    """
    prompt = f"""You are a professional technical translator. Translate the following MDX documentation from English to Russian.

CRITICAL RULES:
1. Translate ALL text content to Russian (paragraphs, headings, list items, etc.)
2. In frontmatter: translate 'summary' field, keep other fields unchanged
3. DO NOT translate: code blocks, command examples, URLs, file paths, configuration values, API names, product names like "OpenClaw"
4. PRESERVE: MDX syntax, frontmatter structure, code block fences, markdown formatting
5. ESCAPE curly braces: In regular text (not code blocks), write \\{{ and \\}} instead of {{ and }}
6. Keep technical terms in English when appropriate (e.g., "session", "webhook", "API")
7. Use professional Russian technical documentation style
8. Keep line breaks and paragraph structure

File: {file_path}

English MDX content:
{content}

Output ONLY the translated Russian MDX content, nothing else:"""

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=8000,
            temperature=0.3,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        translated = message.content[0].text
        return translated
        
    except Exception as e:
        print(f"Error translating {file_path}: {e}")
        return None

def process_file(src_file: Path, dest_file: Path):
    """Process a single MDX file"""
    print(f"Translating: {src_file.relative_to(src_file.parents[2])}")
    
    # Read source file
    with open(src_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Translate
    translated = translate_mdx_to_russian(content, str(src_file.relative_to(src_file.parents[2])))
    
    if translated:
        # Write to destination
        dest_file.parent.mkdir(parents=True, exist_ok=True)
        with open(dest_file, 'w', encoding='utf-8') as f:
            f.write(translated)
        print(f"  ✓ Saved to: {dest_file.relative_to(dest_file.parents[2])}")
        return True
    else:
        print(f"  ✗ Failed")
        return False

def main():
    base_dir = Path(__file__).parent
    en_dir = base_dir / "docs" / "en"
    ru_dir = base_dir / "docs" / "ru"
    
    # Find all MDX files
    mdx_files = sorted(en_dir.rglob("*.mdx"))
    total = len(mdx_files)
    
    print(f"Found {total} MDX files to translate\n")
    
    success_count = 0
    failed_files = []
    
    for i, src_file in enumerate(mdx_files, 1):
        # Calculate destination path
        rel_path = src_file.relative_to(en_dir)
        dest_file = ru_dir / rel_path
        
        # Skip if already exists (for resuming)
        if dest_file.exists():
            print(f"[{i}/{total}] Skipping (exists): {rel_path}")
            success_count += 1
            continue
        
        print(f"[{i}/{total}] ", end="")
        
        if process_file(src_file, dest_file):
            success_count += 1
        else:
            failed_files.append(str(rel_path))
        
        # Rate limiting
        if i < total:
            time.sleep(1)  # Be gentle with API
    
    print(f"\n{'='*60}")
    print(f"Translation complete!")
    print(f"Success: {success_count}/{total}")
    
    if failed_files:
        print(f"\nFailed files ({len(failed_files)}):")
        for f in failed_files:
            print(f"  - {f}")

if __name__ == "__main__":
    main()
