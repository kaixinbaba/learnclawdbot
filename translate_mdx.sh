#!/bin/bash

# Translate MDX documentation from English to Russian using Claude API
# Usage: ./translate_mdx.sh

set -e

# Check for API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "Error: ANTHROPIC_API_KEY environment variable is not set"
    exit 1
fi

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EN_DIR="$BASE_DIR/docs/en"
RU_DIR="$BASE_DIR/docs/ru"

# Count total files
TOTAL_FILES=$(find "$EN_DIR" -name "*.mdx" | wc -l | tr -d ' ')
echo "Found $TOTAL_FILES MDX files to translate"
echo ""

SUCCESS_COUNT=0
SKIPPED_COUNT=0
FAILED_COUNT=0
FAILED_FILES=()

# Function to translate a single file
translate_file() {
    local src_file="$1"
    local rel_path="${src_file#$EN_DIR/}"
    local dest_file="$RU_DIR/$rel_path"
    
    # Skip if already exists
    if [ -f "$dest_file" ]; then
        echo "[SKIP] $rel_path (already exists)"
        ((SKIPPED_COUNT++))
        return 0
    fi
    
    echo -n "[TRANSLATING] $rel_path ... "
    
    # Read source file
    local content=$(cat "$src_file")
    
    # Create prompt
    local prompt="You are a professional technical translator. Translate the following MDX documentation from English to Russian.

CRITICAL RULES:
1. Translate ALL text content to Russian (paragraphs, headings, list items, etc.)
2. In frontmatter: translate 'summary' field, keep other fields unchanged
3. DO NOT translate: code blocks, command examples, URLs, file paths, configuration values, API names, product names like \"OpenClaw\"
4. PRESERVE: MDX syntax, frontmatter structure, code block fences, markdown formatting
5. ESCAPE curly braces: In regular text (not code blocks), write \\{ and \\} instead of { and }
6. Keep technical terms in English when appropriate (e.g., \"session\", \"webhook\", \"API\")
7. Use professional Russian technical documentation style
8. Keep line breaks and paragraph structure

File: $rel_path

English MDX content:
$content

Output ONLY the translated Russian MDX content, nothing else:"
    
    # Call Claude API
    local response=$(curl -s https://api.anthropic.com/v1/messages \
        -H "x-api-key: $ANTHROPIC_API_KEY" \
        -H "anthropic-version: 2023-06-01" \
        -H "content-type: application/json" \
        -d @- << EOF
{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 8000,
    "temperature": 0.3,
    "messages": [
        {
            "role": "user",
            "content": $(echo "$prompt" | jq -Rs .)
        }
    ]
}
EOF
)
    
    # Check for errors
    if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
        local error_msg=$(echo "$response" | jq -r '.error.message')
        echo "FAILED ($error_msg)"
        FAILED_FILES+=("$rel_path")
        ((FAILED_COUNT++))
        return 1
    fi
    
    # Extract translated content
    local translated=$(echo "$response" | jq -r '.content[0].text')
    
    if [ -z "$translated" ] || [ "$translated" = "null" ]; then
        echo "FAILED (empty response)"
        FAILED_FILES+=("$rel_path")
        ((FAILED_COUNT++))
        return 1
    fi
    
    # Write to destination
    mkdir -p "$(dirname "$dest_file")"
    echo "$translated" > "$dest_file"
    
    echo "✓"
    ((SUCCESS_COUNT++))
    
    # Rate limiting - wait 1 second between requests
    sleep 1
}

# Find and translate all MDX files
FILE_NUM=0
while IFS= read -r src_file; do
    ((FILE_NUM++))
    echo "[$FILE_NUM/$TOTAL_FILES]"
    translate_file "$src_file" || true
done < <(find "$EN_DIR" -name "*.mdx" | sort)

# Print summary
echo ""
echo "=========================================="
echo "Translation Summary:"
echo "  Total files: $TOTAL_FILES"
echo "  Translated: $SUCCESS_COUNT"
echo "  Skipped: $SKIPPED_COUNT"
echo "  Failed: $FAILED_COUNT"

if [ ${#FAILED_FILES[@]} -gt 0 ]; then
    echo ""
    echo "Failed files:"
    for file in "${FAILED_FILES[@]}"; do
        echo "  - $file"
    done
fi

echo ""
echo "Translation complete!"
