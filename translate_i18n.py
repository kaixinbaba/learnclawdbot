#!/usr/bin/env python3
"""
Translate i18n JSON files from English to Russian
"""

import os
import json
import anthropic
from pathlib import Path

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

def translate_json_to_russian(json_content: str, file_name: str) -> str:
    """Translate JSON content to Russian using Claude"""
    
    prompt = f"""You are a professional technical translator. Translate the following i18n JSON file from English to Russian.

CRITICAL RULES:
1. Preserve the EXACT JSON structure
2. Translate ALL text values (strings) to Russian
3. DO NOT translate: keys, placeholders like {{count}}, {{error}}, {{status}}, {{mode}}, etc.
4. Keep technical terms when appropriate (e.g., "Stripe", "API", "JSON", "URL", "email")
5. Maintain professional Russian technical style
6. Keep line breaks and formatting within strings

File: {file_name}

English JSON:
{json_content}

Output ONLY the translated Russian JSON, nothing else:"""

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=16000,
            temperature=0.3,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        return message.content[0].text
        
    except Exception as e:
        print(f"Error translating {file_name}: {e}")
        return None

def translate_file(src_path: Path, dest_path: Path):
    """Translate a single JSON file"""
    print(f"Translating: {src_path.name}")
    
    with open(src_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    translated = translate_json_to_russian(content, src_path.name)
    
    if translated:
        # Ensure destination directory exists
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(dest_path, 'w', encoding='utf-8') as f:
            f.write(translated)
        
        print(f"  ✓ Saved to: {dest_path.name}")
        return True
    else:
        print(f"  ✗ Failed")
        return False

def main():
    base_dir = Path(__file__).parent
    en_dir = base_dir / "i18n" / "messages" / "en"
    ru_dir = base_dir / "i18n" / "messages" / "ru"
    
    # Dashboard/Admin files
    admin_files = [
        "Dashboard/Admin/Blogs.json",
        "Dashboard/Admin/Glossary.json",
        "Dashboard/Admin/Orders.json",
        "Dashboard/Admin/Overview.json",
        "Dashboard/Admin/Prices.json",
        "Dashboard/Admin/R2Files.json",
        "Dashboard/Admin/Users.json"
    ]
    
    # Dashboard/User files
    user_files = [
        "Dashboard/User/CreditHistory.json",
        "Dashboard/User/Settings.json"
    ]
    
    all_files = admin_files + user_files
    
    print(f"Translating {len(all_files)} Dashboard JSON files...\n")
    
    success_count = 0
    
    for file_path in all_files:
        src = en_dir / file_path
        dest = ru_dir / file_path
        
        if dest.exists():
            print(f"Skipping (exists): {file_path}")
            success_count += 1
            continue
        
        if translate_file(src, dest):
            success_count += 1
        
        # Rate limiting
        import time
        time.sleep(1)
    
    print(f"\n{'='*60}")
    print(f"Translation complete: {success_count}/{len(all_files)}")

if __name__ == "__main__":
    main()
