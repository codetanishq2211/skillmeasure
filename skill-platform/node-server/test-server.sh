#!/bin/bash
echo "🧪 Testing SkillMeasure Node Server..."

# Check if server is running
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Server is healthy"
else
    echo "❌ Server is not responding"
    exit 1
fi

# Check API endpoint
if curl -f http://localhost:3000/api > /dev/null 2>&1; then
    echo "✅ API endpoint is working"
else
    echo "❌ API endpoint failed"
    exit 1
fi

echo "🎉 All tests passed!"