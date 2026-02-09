#!/bin/bash

# Build script for Verbum Digital Web Radio

echo "Building Verbum Digital Web Radio..."

# Build backend
echo "Building backend..."
cd backend
go build -o ../dist/server ./cmd/server
cd ..

# Build frontend PWAs
echo "Building frontend PWAs..."

echo "Building Admin PWA..."
cd frontend/admin
npm run build
cd ../..

echo "Building Priest PWA..."
cd frontend/priest
npm run build
cd ../..

echo "Building User PWA..."
cd frontend/user
npm run build
cd ../..

echo "Build complete!"
