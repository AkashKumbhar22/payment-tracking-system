# Change directory to backend
cd backend

# Create Virtual Environment if it does not exist
if (-not (Test-Path -Path "venv")) {
    Write-Host "Creating python virtual environment..." -ForegroundColor Cyan
    python -m venv venv
}

# Activate Virtual Environment
Write-Host "Activating virtual environment..." -ForegroundColor Cyan
. venv/Scripts/Activate.ps1

# Install requirements
Write-Host "Installing dependencies..." -ForegroundColor Cyan
pip install -r requirements.txt

# Run migrations & seed db (using SQLite fallback)
$env:USE_SQLITE="True"
Write-Host "Generating migrations..." -ForegroundColor Cyan
python manage.py makemigrations authentication vendors invoices

Write-Host "Applying migrations..." -ForegroundColor Cyan
python manage.py migrate

Write-Host "Seeding database with test accounts..." -ForegroundColor Cyan
python manage.py seed_db

# Run Server
Write-Host "Starting Django Development Server on http://localhost:8000..." -ForegroundColor Green
python manage.py runserver 0.0.0.0:8000
