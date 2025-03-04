#!/bin/bash

# Deployment script for Ant Terraria Game Server
echo "Starting deployment process..."

# Update system packages
echo "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js if not already installed
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install PM2 globally if not already installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Setup PM2 to start on boot
echo "Setting up PM2 to start on boot..."
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

# Start the server with PM2
echo "Starting the server..."
pm2 start server.js --name antsantsants

# Save the PM2 process list
pm2 save

echo "Deployment complete! Server is running."
echo "You can manage the server using PM2 commands:"
echo "  - pm2 status: Check server status"
echo "  - pm2 logs antsantsants: View logs"
echo "  - pm2 restart antsantsants: Restart server"
echo "  - pm2 stop antsantsants: Stop server" 