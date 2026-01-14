#!/bin/bash
# Check for empty TypeScript/JavaScript files in the CRM app

echo "Checking for empty files in apps/crm..."
echo ""

empty_files=()

# Check all .ts and .tsx files
find apps/crm -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) | while read file; do
  # Check if file is empty or only contains whitespace
  if [ ! -s "$file" ] || [ -z "$(cat "$file" | tr -d '[:space:]')" ]; then
    echo "EMPTY: $file"
    empty_files+=("$file")
  fi
done

echo ""
echo "Check complete!"




