# OSRM Setup Script for Windows
# This script downloads and prepares OpenStreetMap data for OSRM

param(
    [string]$Region = "mexico"
)

$ErrorActionPreference = "Stop"

Write-Host "=== OSRM Data Setup ===" -ForegroundColor Cyan
Write-Host "Region: $Region" -ForegroundColor Yellow

$osmFile = "$Region-latest.osm.pbf"
$osrmFile = "$Region-latest.osrm"

# Check if already processed
if (Test-Path $osrmFile) {
    Write-Host "OSRM data already exists. Delete $osrmFile to reprocess." -ForegroundColor Green
    exit 0
}

# Download OSM data if not exists
if (-not (Test-Path $osmFile)) {
    Write-Host "Downloading $osmFile from Geofabrik..." -ForegroundColor Yellow
    $url = "https://download.geofabrik.de/north-america/$osmFile"
    
    try {
        Invoke-WebRequest -Uri $url -OutFile $osmFile -UseBasicParsing
        Write-Host "Download complete!" -ForegroundColor Green
    }
    catch {
        Write-Host "Failed to download. Trying alternative URL..." -ForegroundColor Red
        $url = "https://download.geofabrik.de/north-america/mexico-latest.osm.pbf"
        Invoke-WebRequest -Uri $url -OutFile $osmFile -UseBasicParsing
    }
}

Write-Host "Processing OSM data with OSRM..." -ForegroundColor Yellow

# Extract
Write-Host "Step 1/3: Extracting..." -ForegroundColor Cyan
docker run --rm -v "${PWD}:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/$osmFile

# Partition
Write-Host "Step 2/3: Partitioning..." -ForegroundColor Cyan
docker run --rm -v "${PWD}:/data" osrm/osrm-backend osrm-partition /data/$osrmFile

# Customize
Write-Host "Step 3/3: Customizing..." -ForegroundColor Cyan
docker run --rm -v "${PWD}:/data" osrm/osrm-backend osrm-customize /data/$osrmFile

Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host "You can now start the services with: docker compose --profile routing up -d" -ForegroundColor Yellow
