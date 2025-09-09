# GitHub Actions Workflows

This directory contains GitHub Actions workflows for the hts-pylon-DB project.

## Workflows

### `docker-release.yml`
Builds and publishes Docker images to GitHub Container Registry (GHCR).

**Triggers:**
- **Manual**: `workflow_dispatch` - Run manually with custom parameters
- **Automatic**: Pull requests merged to `main` branch

**Features:**
- Multi-platform Docker builds
- Automatic tagging and versioning
- GitHub Container Registry integration
- PR comment integration for automatic builds
- Build caching for faster builds

## Usage

### Manual Build
1. Go to Actions → "Build and Push Docker Image"
2. Click "Run workflow"
3. Configure build parameters
4. Run

### Automatic Build
1. Create PR targeting `main` branch
2. Add `latest` label to PR
3. Workflow runs automatically
4. Check PR comments for results

## Configuration

### Required Secrets
- `GHCR_TOKEN`: GitHub Container Registry token with `write:packages` permission

### Permissions
- `contents: read` - Checkout code
- `packages: write` - Push to GHCR
- `issues: write` - Comment on PRs (automatic builds)

## Documentation

For detailed documentation, see [docs/GITHUB_ACTIONS.md](../docs/GITHUB_ACTIONS.md).
