#!/bin/bash
# OSRM Setup Script
# This script downloads and prepares OpenStreetMap data for OSRM

set -e

REGION="${1:-peru}"
OSM_FILE="${REGION}-latest.osm.pbf"
OSRM_FILE="${REGION}-latest.osrm"

echo "=== OSRM Data Setup ==="
echo "Region: $REGION"

# Check if already processed
if [ -f "$OSRM_FILE" ]; then
    echo "OSRM data already exists. Delete $OSRM_FILE to reprocess."
    exit 0
fi

# Download OSM data if not exists
if [ ! -f "$OSM_FILE" ]; then
    echo "Downloading $OSM_FILE from Geofabrik..."
    URL="https://download.geofabrik.de/south-america/${OSM_FILE}"
    
    if command -v wget &> /dev/null; then
        wget -O "$OSM_FILE" "$URL" || {
            echo "Download failed, trying alternative..."
            wget -O "$OSM_FILE" "https://download.geofabrik.de/south-america/peru-latest.osm.pbf"
        }
    else
        curl -L -o "$OSM_FILE" "$URL" || {
            echo "Download failed, trying alternative..."
            curl -L -o "$OSM_FILE" "https://download.geofabrik.de/south-america/peru-latest.osm.pbf"
        }
    fi
    
    echo "Download complete!"
fi

echo "Processing OSM data with OSRM..."

# Extract
echo "Step 1/3: Extracting..."
docker run --rm -v "$(pwd):/data" osrm/osrm-backend osrm-extract -p /opt/car.lua "/data/$OSM_FILE"

# Partition
echo "Step 2/3: Partitioning..."
docker run --rm -v "$(pwd):/data" osrm/osrm-backend osrm-partition "/data/$OSRM_FILE"

# Customize
echo "Step 3/3: Customizing..."
docker run --rm -v "$(pwd):/data" osrm/osrm-backend osrm-customize "/data/$OSRM_FILE"

echo "=== Setup Complete ==="
echo "You can now start the services with: docker compose --profile routing up -d"
