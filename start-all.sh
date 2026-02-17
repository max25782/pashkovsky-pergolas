#!/bin/bash

# Start all services for Pashkovsky Pergolas project
# This script starts all services in parallel using background processes

echo "🚀 Starting all Pashkovsky services..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to start a service
start_service() {
  local name=$1
  local dir=$2
  local port=$3
  
  echo -e "${BLUE}Starting ${name}...${NC}"
  cd "$dir" || exit 1
  
  # Start in background and capture PID
  npm run dev > "/tmp/${name}.log" 2>&1 &
  local pid=$!
  echo $pid > "/tmp/${name}.pid"
  
  echo -e "${GREEN}✓ ${name} started (PID: ${pid}, Port: ${port})${NC}"
  echo -e "${YELLOW}  Logs: tail -f /tmp/${name}.log${NC}"
  echo ""
  
  cd - > /dev/null || exit 1
}

# Check if we're in the right directory
if [ ! -d "apps" ]; then
  echo "❌ Error: Please run this script from the project root directory"
  exit 1
fi

# Start Profiles API (port 3002)
start_service "profiles-api" "apps/profiles-api" "3002"

# Wait a bit for API to start
sleep 3

# Start Profiles Store (port 3003)
start_service "profiles-store" "apps/profiles-store" "3003"

# Start CRM (if needed)
# start_service "crm" "apps/crm" "3000"

# Start Site (if needed)
# start_service "site" "apps/site" "3001"

echo ""
echo -e "${GREEN}✅ All services started!${NC}"
echo ""
echo "Services:"
echo "  - Profiles API:    http://localhost:3002"
echo "  - Profiles Store:  http://localhost:3003"
echo ""
echo "To stop all services, run: ./stop-all.sh"
echo "To view logs: tail -f /tmp/<service-name>.log"
