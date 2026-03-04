# deploy.ps1
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  Handwriting Font Maker - Auto Deploy Script" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: GitHub Login
Write-Host "[1/4] Authenticating with GitHub..." -ForegroundColor Yellow
Write-Host "A browser window will open. Please click 'Authorize' to grant access."
gh auth login --web -h github.com

# Step 2: Create GitHub Repo and Push
Write-Host "`n[2/4] Creating a private GitHub repository..." -ForegroundColor Yellow
# Try to create, ignore if exists
gh repo create handwriting-font-maker --private --source=. --push
# Ensure we push latest
git push -u origin master

# Step 3: Vercel Login
Write-Host "`n[3/4] Authenticating with Vercel..." -ForegroundColor Yellow
Write-Host "A browser window will open. Please log in to Vercel and click 'Authorize'."
vercel login

# Step 4: Deploy to Vercel
Write-Host "`n[4/4] Deploying application to Vercel..." -ForegroundColor Yellow
Write-Host "Press ENTER/Return to the default settings when prompted by Vercel."
vercel --prod

Write-Host "`n==============================================" -ForegroundColor Green
Write-Host "  Deployment Complete! " -ForegroundColor Green
Write-Host "  You can find your live URL in the text above." -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
