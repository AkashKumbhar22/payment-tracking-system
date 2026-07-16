# Change directory to frontend
cd frontend

# Install package dependencies
Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
npm install

# Run Vite dev server
Write-Host "Starting Vite development server..." -ForegroundColor Green
npm run dev
