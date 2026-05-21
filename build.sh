#!/bin/bash

# Build the extension package using vsce (through docker run)
docker compose run --rm extension npm run build

# Move the generated .vsix file to the dist folder
mkdir -p dist
mv *.vsix dist/
