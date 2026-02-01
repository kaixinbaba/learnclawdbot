#!/bin/bash
# Translate docs from English to target locale
# Usage: ./scripts/translate-docs.sh <target_locale> <source_dir> [section...]
# Example: ./scripts/translate-docs.sh zh docs/en start help install

set -e

TARGET_LOCALE="$1"
SOURCE_DIR="$2"
shift 2
SECTIONS=("$@")

if [ -z "$TARGET_LOCALE" ] || [ -z "$SOURCE_DIR" ]; then
  echo "Usage: $0 <target_locale> <source_dir> [section...]"
  exit 1
fi

DOCS_ROOT="$(dirname "$SOURCE_DIR")"
TARGET_DIR="$DOCS_ROOT/$TARGET_LOCALE"

LOCALE_NAMES=("zh:中文" "ja:日本語" "ko:한국어" "ru:Русский" "ar:العربية")

get_locale_name() {
  for pair in "${LOCALE_NAMES[@]}"; do
    key="${pair%%:*}"
    val="${pair#*:}"
    if [ "$key" = "$1" ]; then
      echo "$val"
      return
    fi
  done
  echo "$1"
}

LOCALE_NAME=$(get_locale_name "$TARGET_LOCALE")

count=0
for section in "${SECTIONS[@]}"; do
  find "$SOURCE_DIR/$section" -type f -name "*.mdx" | while read -r src_file; do
    rel_path="${src_file#$SOURCE_DIR/}"
    target_file="$TARGET_DIR/$rel_path"
    
    if [ -f "$target_file" ]; then
      echo "SKIP (exists): $rel_path"
      continue
    fi
    
    mkdir -p "$(dirname "$target_file")"
    echo "TRANSLATE: $rel_path → $TARGET_LOCALE"
    count=$((count + 1))
  done
done

echo ""
echo "Files to translate listed above."
echo "Target locale: $TARGET_LOCALE ($LOCALE_NAME)"
echo "Target dir: $TARGET_DIR"
