#!/bin/bash

# Stop all services started by start-all.sh

echo "🛑 Stopping all Pashkovsky services..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

stop_service() {
  local name=$1
  local pid_file="/tmp/${name}.pid"
  
  if [ -f "$pid_file" ]; then
    local pid=$(cat "$pid_file")
    if ps -p "$pid" > /dev/null 2>&1; then
      kill "$pid" 2>/dev/null
      echo -e "${GREEN}✓ Stopped ${name} (PID: ${pid})${NC}"
    else
      echo -e "${RED}✗ ${name} was not running${NC}"
    fi
    rm -f "$pid_file"
  else
    echo -e "${RED}✗ ${name} PID file not found${NC}"
  fi
}

stop_service "profiles-api"
stop_service "profiles-store"
stop_service "crm"
stop_service "site"

echo ""
echo -e "${GREEN}✅ Done!${NC}"
