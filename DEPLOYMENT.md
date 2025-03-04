# Deployment Guide for Ant Terraria Game Server

This guide provides instructions for deploying your game server to a VPS (Virtual Private Server) in a cost-effective way that can handle multiple players.

## Recommended VPS Providers

- **DigitalOcean**: Droplets start at $4/month (1GB RAM)
- **Linode**: Basic VPS starts at $5/month (1GB RAM)
- **Vultr**: Cloud Compute starts at $2.50/month (512MB RAM)

## Recommended Server Specifications

For 20-50 concurrent players:
- 2GB RAM
- 1-2 vCPUs
- 50GB SSD storage
- Ubuntu 20.04 LTS or newer

## Deployment Steps

### 1. Set Up Your VPS

1. Sign up with a VPS provider and create a new server with Ubuntu
2. Connect to your server via SSH:
   ```
   ssh root@your_server_ip
   ```

3. Create a non-root user:
   ```
   adduser gameuser
   usermod -aG sudo gameuser
   ```

4. Switch to the new user:
   ```
   su - gameuser
   ```

### 2. Install Required Software

1. Update your system:
   ```
   sudo apt update
   sudo apt upgrade -y
   ```

2. Install Node.js:
   ```
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. Install PM2 (process manager):
   ```
   sudo npm install -g pm2
   ```

4. Install Nginx (for reverse proxy):
   ```
   sudo apt install nginx -y
   ```

### 3. Deploy Your Game

1. Clone your repository:
   ```
   git clone https://your-repository-url.git ~/antsantsants
   cd ~/antsantsants
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the server with PM2:
   ```
   pm2 start server.js --name antsantsants
   ```

4. Configure PM2 to start on boot:
   ```
   pm2 startup
   sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u gameuser --hp /home/gameuser
   pm2 save
   ```

### 4. Set Up Nginx as a Reverse Proxy

1. Create an Nginx configuration file:
   ```
   sudo nano /etc/nginx/sites-available/antsantsants
   ```

2. Paste the contents of the nginx-config.conf file from this repository

3. Enable the site:
   ```
   sudo ln -s /etc/nginx/sites-available/antsantsants /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

### 5. Set Up a Domain (Optional but Recommended)

1. Purchase a domain name from a registrar like Namecheap or GoDaddy
2. Point your domain to your server's IP address by creating an A record
3. Update the Nginx configuration with your domain name

### 6. Set Up SSL (Optional but Recommended)

1. Install Certbot:
   ```
   sudo apt install certbot python3-certbot-nginx -y
   ```

2. Obtain an SSL certificate:
   ```
   sudo certbot --nginx -d yourdomain.com
   ```

## Monitoring and Maintenance

### Monitor Server Performance

1. Check server status:
   ```
   pm2 status
   ```

2. View logs:
   ```
   pm2 logs antsantsants
   ```

3. Monitor system resources:
   ```
   sudo apt install htop -y
   htop
   ```

### Backup Your World Data

1. Set up automatic backups:
   ```
   mkdir -p ~/backups
   ```

2. Create a backup script (~/backup-world.sh):
   ```bash
   #!/bin/bash
   TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
   cp ~/antsantsants/world_save.json ~/backups/world_save-$TIMESTAMP.json
   ```

3. Make it executable:
   ```
   chmod +x ~/backup-world.sh
   ```

4. Set up a cron job to run daily:
   ```
   crontab -e
   ```
   Add this line:
   ```
   0 0 * * * ~/backup-world.sh
   ```

## Scaling Tips

1. **Monitor before scaling**: Use tools like `htop` to monitor CPU and memory usage
2. **Vertical scaling**: Increase RAM and CPU on your VPS if needed
3. **Optimize your code**: Look for performance bottlenecks in your server code
4. **Consider a CDN**: Use a CDN for static assets to reduce server load

## Troubleshooting

1. **Server crashes**: Check PM2 logs for errors
   ```
   pm2 logs antsantsants
   ```

2. **Connection issues**: Check Nginx logs
   ```
   sudo tail -f /var/log/nginx/error.log
   ```

3. **Performance issues**: Monitor system resources
   ```
   htop
   ```

4. **World save issues**: Check file permissions
   ```
   ls -la ~/antsantsants/world_save.json
   ``` 