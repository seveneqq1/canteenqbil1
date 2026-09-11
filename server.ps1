# server.ps1
# A simple script to start a local HTTP server for testing HTML/CSS/JS.

Write-Host "Starting local web server for the Canteen App..." -ForegroundColor Cyan
Write-Host "Open your browser to: http://localhost:8000" -ForegroundColor Green

# Using Python's built-in HTTP server which is natively available on macOS
python3 -m http.server 8000

# If you are on Windows and don't have Python, you can comment out the line above 
# and uncomment the Node.js alternative below (requires running 'npm install -g http-server' first):
# npx http-server -p 8000