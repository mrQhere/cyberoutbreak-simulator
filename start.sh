#!/bin/bash
echo "Starting CyberOutbreak Simulator..."

# Check if Python is installed
if ! command -v python3 &> /dev/null
then
    echo "Python3 could not be found. Please install Python3 to run the server."
    exit 1
fi

# Set up virtual environment to avoid PEP-668 OS package conflicts
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Check and install dependencies
echo "Installing/verifying dependencies..."
python3 -m pip install -r requirements.txt --quiet

# Start the Flask server in the background
echo "Starting server on port 8000..."
python3 server.py &
SERVER_PID=$!

# Wait for server to boot
sleep 2

# Open browser
if command -v xdg-open &> /dev/null
then
    xdg-open http://127.0.0.1:8000
elif command -v open &> /dev/null
then
    open http://127.0.0.1:8000
else
    echo "Server running at http://127.0.0.1:8000 (Could not auto-open browser)"
fi

echo "Press Ctrl+C to stop the server."
wait $SERVER_PID
