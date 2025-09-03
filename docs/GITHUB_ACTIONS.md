# GitHub Actions Workflow

This repository includes a simple GitHub Actions workflow for building and publishing Docker images to GitHub Container Registry (GHCR).

## Workflow Overview

### Docker Build (`docker-release.yml`)
**Trigger:** Manual only

- Simple, manual Docker image build
- Single platform build (linux/amd64) for speed
- Uses GitHub Container Registry (GHCR)
- Includes build caching for faster builds
- Always pushes to `latest` tag

## Usage

### Manual Build
To build and push a Docker image:
1. Go to Actions tab in GitHub
2. Select "Build Docker Image" workflow
3. Click "Run workflow"
4. Click "Run workflow" button

The image will be built and pushed to:
```
ghcr.io/your-username/hts-pylon-db:latest
```

### Pulling the Image
```bash
docker pull ghcr.io/your-username/hts-pylon-db:latest
```

### Running the Image
```bash
docker run -d \
  --name hts-dashboard \
  -p 3000:3001 \
  -e PYLON_API_URL=your_api_url \
  -e PYLON_API_TOKEN=your_api_token \
  -e REDIS_URL=redis://your_redis_url \
  ghcr.io/your-username/hts-pylon-db:latest
```

## Configuration

### Required Secrets
The workflow uses the built-in `GITHUB_TOKEN` which is automatically provided by GitHub Actions. No additional secrets are required.

### Registry Access
Images are published to GitHub Container Registry (GHCR) under your repository namespace:
- `ghcr.io/{owner}/{repository}:latest`

### Permissions
The workflow requires these permissions:
- `contents: read` - To checkout code
- `packages: write` - To push to GHCR

## Monitoring

### Build Status
Check build status in the Actions tab:
- ✅ Green: Build successful
- ❌ Red: Build failed
- 🟡 Yellow: Build in progress

## Troubleshooting

### Common Issues

1. **Build fails on dependency installation**
   - Check if package.json files are valid
   - Ensure all dependencies are available

2. **Push to GHCR fails**
   - Verify repository permissions
   - Check if GHCR is enabled for the repository

### Getting Help
- Check the Actions tab for detailed logs
- Review the workflow file for configuration
- Open an issue for persistent problems
