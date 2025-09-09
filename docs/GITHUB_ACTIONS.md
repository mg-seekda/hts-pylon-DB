# GitHub Actions Workflow

This repository includes a flexible GitHub Actions workflow for building and publishing Docker images to GitHub Container Registry (GHCR).

## Workflow Overview

### Docker Build (`docker-release.yml`)
**Triggers:** 
- **Manual**: workflow_dispatch (existing functionality)
- **Automatic**: Pull requests merged to main branch

- **Flexible branch selection**: Choose which branch to build from (manual only)
- **Custom Docker tagging**: Specify custom tags or use 'latest' as default
- **Optional registry push**: Choose whether to push to registry or just build locally
- **Multi-tag support**: Automatically creates multiple tags for better versioning
- **Build caching**: Uses GitHub Actions cache for faster builds
- **Single platform**: linux/amd64 for speed and compatibility
- **PR integration**: Automatically builds and comments on merged PRs

## Usage

### Automatic Build (Merged PR)
The workflow automatically triggers when:
1. A pull request is **merged** into the `main` branch
2. Changes are made to files (excluding documentation files)

The workflow will:
- Build the Docker image from the merged code
- Always tag as `latest` plus additional version tags
- Push to GitHub Container Registry with multiple tags
- Comment on the PR with build details and image tags

### Manual Build
To build and push a Docker image manually:
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

**Manual builds:**
- **Custom tag** (if provided) or `latest` (if empty)
- **Branch-specific**: `{branch}-{run_number}` (e.g., `dev-123`)
- **Commit-based**: `{branch}-{short-sha}` (e.g., `main-a1b2c3d`)

**Automatic PR builds (merged PRs):**
- **latest** - Always tagged as latest for merged PR builds
- **Run number**: `{run_number}` (e.g., `123`)
- **Branch-commit**: `{branch}-{short-sha}` (e.g., `main-a1b2c3d`)

### Example Images
```
# Manual builds
ghcr.io/mg-seekda/hts-pylon-db:latest
ghcr.io/mg-seekda/hts-pylon-db:v1.2.3
ghcr.io/mg-seekda/hts-pylon-db:dev-123
ghcr.io/mg-seekda/hts-pylon-db:main-a1b2c3d

# Automatic PR builds (merged PRs)
ghcr.io/mg-seekda/hts-pylon-db:latest
ghcr.io/mg-seekda/hts-pylon-db:123
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

## PR Workflow

### How to trigger automatic builds
1. Create a pull request targeting the `main` branch
2. **Merge** the pull request into `main`
3. The workflow will automatically:
   - Build the Docker image from the merged code
   - Always tag as `latest` plus additional version tags
   - Push it to GitHub Container Registry
   - Comment on the PR with build details and image tags

### PR Comments
When a build is triggered by a merged PR, the workflow will:
- Post a comment with build status and image tags
- Include links to the build logs and registry
- Show that the build was triggered by a merged PR

### Build Behavior
- **Only merged PRs**: Builds only trigger when PRs are merged, not when opened/updated
- **Always latest tag**: Merged PRs are always tagged as `latest`
- **No labels required**: No need to add any labels to trigger builds

## Monitoring

### Build Status
Check build status in the Actions tab:
- ✅ Green: Build successful
- ❌ Red: Build failed
- 🟡 Yellow: Build in progress

### PR Builds
- Check the PR comments for build results (after merging)
- View detailed logs in the Actions tab
- Monitor the GitHub Container Registry for new images
- Builds only occur when PRs are merged, not on every update

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
