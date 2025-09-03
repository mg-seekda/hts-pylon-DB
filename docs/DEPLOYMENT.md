# HTS Dashboard - Deployment Guide

This guide covers deploying the HTS Dashboard using Docker containers in production environments.

## 🚀 Quick Start

### Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- SSL certificates (for production)
- Pylon API credentials
- Domain name (for production)

### 1. Environment Setup

Copy the production environment template:
```bash
cp env.production.example .env.production
```

Edit `.env.production` with your configuration:
```bash
# Required
PYLON_API_URL=https://your-pylon-instance.com/api
PYLON_API_TOKEN=your_production_api_token

# Optional
CORS_ORIGIN=https://your-domain.com
CAS_LOGIN_URL=https://login.seekda.com/login
CAS_VALIDATE_URL=https://login.seekda.com/serviceValidate
```

### 2. SSL Certificates

Place your SSL certificates in the `nginx/ssl/` directory:
- `nginx/ssl/cert.pem` - SSL certificate
- `nginx/ssl/key.pem` - SSL private key

For development/testing, generate self-signed certificates:
```bash
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem
```

### 3. Deploy

**Linux/macOS:**
```bash
./scripts/deploy.sh
```

**Windows:**
```powershell
.\scripts\deploy.ps1
```

## 🐳 Docker Configuration

### Services

The deployment includes three services:

1. **hts-dashboard** - Main application
2. **redis** - Caching layer
3. **nginx** - Reverse proxy and SSL termination

### Ports

- `80` - HTTP (redirects to HTTPS)
- `443` - HTTPS
- `3001` - Internal application port
- `6379` - Redis port (internal only)

### Volumes

- `./logs` - Application and nginx logs
- `redis_data` - Redis persistence

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PYLON_API_URL` | Pylon API base URL | - | ✅ |
| `PYLON_API_TOKEN` | Pylon API token | - | ✅ |
| `NODE_ENV` | Environment mode | production | ❌ |
| `PORT` | Application port | 3001 | ❌ |
| `REDIS_URL` | Redis connection URL | redis://redis:6379 | ❌ |
| `REDIS_ENABLED` | Enable Redis caching | true | ❌ |
| `CAS_LOGIN_URL` | CAS login URL | https://login.seekda.com/login | ❌ |
| `CAS_VALIDATE_URL` | CAS validation URL | https://login.seekda.com/serviceValidate | ❌ |
| `CORS_ORIGIN` | CORS allowed origin | http://localhost:3001 | ❌ |

### Nginx Configuration

The nginx configuration includes:
- SSL/TLS termination
- CAS authentication
- Rate limiting
- Gzip compression
- Security headers
- Static file caching

## 📊 Monitoring

### Health Checks

- **Application**: `GET /api/health`
- **Nginx**: Built-in health checks
- **Redis**: Built-in health checks

### Logs

View logs for all services:
```bash
docker-compose logs -f
```

View logs for specific service:
```bash
docker-compose logs -f hts-dashboard
docker-compose logs -f nginx
docker-compose logs -f redis
```

### Metrics

The application exposes health check endpoints:
- `https://your-domain.com/health` - Overall health
- `https://your-domain.com/api/health` - API health

## 🔒 Security

### Authentication

- **Production**: CAS authentication via nginx
- **Development**: Bypass mode (set `DEV_BYPASS_AUTH=true`)

### SSL/TLS

- TLS 1.2+ only
- Strong cipher suites
- HSTS headers
- Certificate validation

### Security Headers

- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security: max-age=31536000

### Rate Limiting

- API endpoints: 10 requests/second
- Login endpoints: 1 request/second

## 🚨 Troubleshooting

### Common Issues

1. **SSL Certificate Errors**
   ```bash
   # Check certificate validity
   openssl x509 -in nginx/ssl/cert.pem -text -noout
   ```

2. **Service Not Starting**
   ```bash
   # Check service logs
   docker-compose logs hts-dashboard
   ```

3. **Redis Connection Issues**
   ```bash
   # Test Redis connection
   docker-compose exec redis redis-cli ping
   ```

4. **API Connection Issues**
   ```bash
   # Test API connectivity
   curl -f https://your-domain.com/api/health
   ```

### Debug Mode

Enable debug logging:
```bash
# Set environment variable
export NODE_ENV=development

# Restart services
docker-compose restart hts-dashboard
```

### Performance Issues

1. **Enable Redis Caching**
   ```bash
   # Already enabled by default in production
   REDIS_ENABLED=true
   ```

2. **Check Resource Usage**
   ```bash
   docker stats
   ```

3. **Monitor Logs**
   ```bash
   docker-compose logs -f | grep -i error
   ```

## 🔄 Updates

### Rolling Updates

```bash
# Pull latest images
docker-compose pull

# Update services
docker-compose up -d

# Verify health
docker-compose ps
```

### Database Migrations

No database migrations required - the application uses external APIs only.

## 📋 Maintenance

### Regular Tasks

1. **Log Rotation**
   ```bash
   # Logs are stored in ./logs/
   # Set up log rotation for production
   ```

2. **SSL Certificate Renewal**
   ```bash
   # Update certificates in nginx/ssl/
   # Restart nginx service
   docker-compose restart nginx
   ```

3. **Security Updates**
   ```bash
   # Update base images
   docker-compose pull
   docker-compose up -d
   ```

### Backup

No persistent data to backup - all data comes from external APIs.

## 🆘 Support

For deployment issues:
1. Check logs: `docker-compose logs -f`
2. Verify configuration: `docker-compose config`
3. Test connectivity: `curl -f https://your-domain.com/health`
4. Check resource usage: `docker stats`
