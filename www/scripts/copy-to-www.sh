#!/bin/bash
# Copies web assets to www/ for Capacitor iOS (run from project root via npm run copy:www)
set -e
mkdir -p www
rsync -a --delete \
  --exclude='node_modules' \
  --exclude='ios' \
  --exclude='.git' \
  --exclude='www' \
  --exclude='asteroid-app' \
  --exclude='asteroid67' \
  --exclude='boostnotifier' \
  --exclude='asteroid' \
  --exclude='asteroid8' \
  --exclude='shannon' \
  --exclude='functions' \
  --exclude='supabase' \
  --exclude='.firebase' \
  --exclude='.cursor' \
  --exclude='.vscode' \
  --exclude='.DS_Store' \
  --exclude='y' \
  --exclude='Asteriod files' \
  . www/
