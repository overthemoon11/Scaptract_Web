#!/bin/bash
# Bash script to check OCR API status

echo "Checking OCR API Status..."
echo ""

# Check Image OCR API (Port 8001)
echo "Image OCR API (Port 8001):"
if curl -s -f -m 2 http://localhost:8001/health > /dev/null 2>&1; then
    echo "  ✓ Running"
    curl -s http://localhost:8001/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:8001/health
else
    echo "  ✗ Not running or unreachable"
fi

echo ""

# Check PDF OCR API (Port 8002)
echo "PDF OCR API (Port 8002):"
if curl -s -f -m 2 http://localhost:8002/health > /dev/null 2>&1; then
    echo "  ✓ Running"
    curl -s http://localhost:8002/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:8002/health
else
    echo "  ✗ Not running or unreachable"
fi

echo ""

# Check if ports are in use (Linux/Mac)
if command -v lsof > /dev/null 2>&1; then
    echo "Port Status:"
    if lsof -i :8001 > /dev/null 2>&1; then
        echo "  Port 8001: In use"
        lsof -i :8001
    else
        echo "  Port 8001: Not in use"
    fi
    
    if lsof -i :8002 > /dev/null 2>&1; then
        echo "  Port 8002: In use"
        lsof -i :8002
    else
        echo "  Port 8002: Not in use"
    fi
fi
