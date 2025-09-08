# GitHub Actions Workflow

This repository includes a flexible GitHub Actions workflow for building and publishing Docker images to GitHub Container Registry (GHCR).

## Workflow Overview

### Docker Build (`docker-release.yml`)
**Trigger:** Manual only (workflow_dispatch)

- **Flexible branch selection**: Choose which branch to build from
- **Custom Docker tagging**: Specify custom tags or use 'latest' as default
- **Optional registry push**: Choose whether to push to registry or just build locally
- **Multi-tag support**: Automatically creates multiple tags for better versioning
- **Build caching**: Uses GitHub Actions cache for faster builds
- **Single platform**: linux/amd64 for speed and compatibility

## Usage

### Manual Build
To build and push a Docker image:
1. Go to Actions tab in GitHub
2. Select "Build and Push Docker Image" workflow
3. Click "Run workflow"
4. Configure the build options:
   - **Branch**: Choose which branch to build from (main, dev, dev-history_closed_by_assignee)
   - **Docker tag**: Enter custom tag (leave empty for 'latest')
   - **Push to registry**: Toggle whether to push to GHCR or just build locally
5. Click "Run workflow" button

### Available Branches
- `main` - Production branch
- `dev` - Development branch  
- `dev-history_closed_by_assignee` - Feature branch

### Docker Tags
The workflow creates multiple tags automatically:
- **Custom tag** (if provided) or `latest` (if empty)
- **Branch-specific**: `{branch}-{run_number}` (e.g., `dev-123`)
- **Commit-based**: `{branch}-{short-sha}` (e.g., `main-a1b2c3d`)

### Example Images
```
ghcr.io/mg-seekda/hts-pylon-db:latest
ghcr.io/mg-seekda/hts-pylon-db:v1.2.3
ghcr.io/mg-seekda/hts-pylon-db:dev-123
ghcr.io/mg-seekda/hts-pylon-db:main-a1b2c3d
```

### Pulling the Image
```bash
# Pull latest version
docker pull ghcr.io/mg-seekda/hts-pylon-db:latest

# Pull specific version
docker pull ghcr.io/mg-seekda/hts-pylon-db:v1.2.3

# Pull branch-specific build
docker pull ghcr.io/mg-seekda/hts-pylon-db:dev-123
```

### Running the Image
```bash
# Run latest version
docker run -d \
  --name hts-dashboard \
  -p 3000:3001 \
  -e PYLON_API_URL=your_api_url \
  -e PYLON_API_TOKEN=your_api_token \
  -e REDIS_URL=redis://your_redis_url \
  ghcr.io/mg-seekda/hts-pylon-db:latest

# Run specific version
docker run -d \
  --name hts-dashboard \
  -p 3000:3001 \
  -e PYLON_API_URL=your_api_url \
  -e PYLON_API_TOKEN=your_api_token \
  -e REDIS_URL=redis://your_redis_url \
  ghcr.io/mg-seekda/hts-pylon-db:v1.2.3
```

## Workflow Inputs

### Branch Selection
- **Type**: Choice (dropdown)
- **Options**: main, dev, dev-history_closed_by_assignee
- **Default**: main
- **Description**: Choose which branch to build the Docker image from

### Docker Tag
- **Type**: String (optional)
- **Default**: Empty (uses 'latest')
- **Description**: Custom tag for the Docker image. If left empty, uses 'latest'

### Push to Registry
- **Type**: Boolean
- **Default**: true
- **Description**: Whether to push the built image to GitHub Container Registry

## Configuration

### Required Secrets
The workflow requires a `GHCR_TOKEN` secret to push to GitHub Container Registry:

1. Go to your GitHub repository settings
2. Navigate to "Secrets and variables" → "Actions"
3. Click "New repository secret"
4. Name: `GHCR_TOKEN`
5. Value: Generate a Personal Access Token with `write:packages` permission

### Registry Access
Images are published to GitHub Container Registry (GHCR) under your repository namespace:
- `ghcr.io/{owner}/hts-pylon-db:latest`

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
