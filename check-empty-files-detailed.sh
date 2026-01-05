#!/bin/bash
# Detailed check for empty or problematic files

echo "=== Checking for empty or problematic files in apps/crm ==="
echo ""

found_issues=0

# Check all TypeScript/TSX files
find apps/crm/app -type f \( -name "*.ts" -o -name "*.tsx" \) | while read file; do
  # Skip if file doesn't exist
  [ ! -f "$file" ] && continue
  
  # Get file size and line count
  size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)
  lines=$(wc -l < "$file" 2>/dev/null || echo 0)
  
  # Check if file is completely empty
  if [ "$size" -eq 0 ] || [ "$lines" -eq 0 ]; then
    echo "❌ EMPTY: $file (0 bytes, 0 lines)"
    found_issues=$((found_issues + 1))
    continue
  fi
  
  # Check if file only has whitespace (less than 50 bytes and only whitespace)
  if [ "$size" -lt 50 ]; then
    content=$(cat "$file" 2>/dev/null | tr -d '[:space:]')
    if [ -z "$content" ]; then
      echo "⚠️  WHITESPACE ONLY: $file ($size bytes, $lines lines)"
      found_issues=$((found_issues + 1))
      continue
    fi
  fi
  
  # Check for suspiciously small route/page files
  if [[ "$file" == *"route.ts" ]] || [[ "$file" == *"page.tsx" ]]; then
    if [ "$lines" -lt 10 ] && [ "$lines" -gt 0 ]; then
      # Check if it's just comments/whitespace
      non_empty_lines=$(grep -v '^\s*$' "$file" | grep -v '^\s*//' | grep -v '^\s*/\*' | grep -v '^\s*\*' | wc -l)
      if [ "$non_empty_lines" -lt 3 ]; then
        echo "⚠️  SUSPICIOUSLY SMALL: $file ($lines lines, $non_empty_lines non-empty)"
        found_issues=$((found_issues + 1))
      fi
    fi
  fi
done

echo ""
if [ "$found_issues" -eq 0 ]; then
  echo "✅ No empty or problematic files found!"
else
  echo "Found $found_issues potential issues"
fi

