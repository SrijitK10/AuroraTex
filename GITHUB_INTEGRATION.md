# GitHub Integration for AuroraTex

## Overview

AuroraTex now includes comprehensive Git and GitHub integration, enabling collaborative file access and sharing similar to VS Code. This feature allows users to version control their LaTeX projects, collaborate with others, and sync their work with GitHub repositories.

## Features

### 🔧 Git Integration

- **Repository Management**
  - Initialize new Git repositories
  - Clone existing repositories
  - View repository status and changes
  - Stage and unstage files
  - Commit changes with descriptive messages
  - Discard unwanted changes

- **Branch Management**
  - Create new branches
  - Switch between branches
  - View all branches in the repository
  - Current branch indicator

- **Remote Operations**
  - Pull latest changes from remote
  - Push commits to remote
  - Fetch updates without merging
  - Add and remove remotes

- **Change Tracking**
  - Visual indicators for file status:
    - 🟠 Modified files
    - 🟢 Added files
    - 🔴 Deleted files
    - 🔵 Untracked files
    - ⚠️ Conflicted files

- **Diff Viewer**
  - View file changes with syntax highlighting
  - Side-by-side comparison of changes
  - Line-by-line diff with additions and deletions

### 🐙 GitHub Integration

- **Authentication**
  - Sign in through GitHub in the browser
  - Personal Access Token (PAT) fallback
  - Secure credential storage
  - Persistent authentication across sessions

- **Repository Operations**
  - List all repositories
  - Create new repositories (public/private)
  - Fork repositories
  - Parse GitHub URLs

- **Pull Requests**
  - View open/closed pull requests
  - Create new pull requests
  - Pull request details (author, date, status)

- **User Profile**
  - Display GitHub username
  - Show user avatar
  - Sign out functionality

- **Collaboration**
  - Invite GitHub users to the current project repository
  - Choose read, triage, write, maintain, or admin access
  - View current repository collaborators

## Getting Started

### Prerequisites

1. **Git Installation**: Ensure Git is installed on your system
   ```bash
   # Check if Git is installed
   git --version
   
   # Install Git if needed:
   # macOS: brew install git
   # Ubuntu: sudo apt-get install git
   # Windows: Download from git-scm.com
   ```

2. **GitHub Account**: Create a free account at [github.com](https://github.com)

3. **Browser Sign-In Configuration**: Set `GITHUB_CLIENT_ID` to the Client ID from your GitHub OAuth app.
   - The OAuth app must have device flow enabled
   - The app requests `repo`, `read:user`, and `user:email` scopes so it can create repositories and invite collaborators

4. **Personal Access Token Fallback**: Generate a PAT only if browser sign-in is unavailable
   - Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate new token with `repo` scope
   - Copy the token (you won't see it again!)

### Initializing a Repository

1. Open your LaTeX project in AuroraTex
2. Click the **Source Control** icon in the left sidebar (code branch icon)
3. If not a Git repository, click **Initialize Repository**
4. Your project is now version-controlled!

### Making Your First Commit

1. Make changes to your LaTeX files
2. Open **Source Control** panel
3. You'll see modified files under "Changes"
4. Click the **+** icon next to files to stage them
5. Or click **Stage All** to stage all changes
6. Enter a commit message (e.g., "Initial commit")
7. Click **Commit** button

### Connecting to GitHub

1. In Source Control panel, click **Sign in to GitHub**
2. Click **Continue with GitHub**
3. Complete the browser sign-in flow
4. Your GitHub username and avatar will appear

If browser sign-in is not configured, use **Use personal access token** and enter a PAT with `repo` scope.

### Creating a GitHub Repository

1. Sign in to GitHub (see above)
2. Use the IPC API to create a repository:
   ```typescript
   const { repo } = await window.api.invoke('GitHub.CreateRepository', {
     name: 'my-latex-project',
     description: 'My awesome LaTeX project',
     isPrivate: false
   });
   ```

### Pushing to GitHub

1. Add GitHub remote to your local repository:
   ```bash
   git remote add origin https://github.com/username/repo.git
   ```
2. In Source Control panel, click **Push** button
3. Your commits will be pushed to GitHub!

### Pulling from GitHub

1. Click **Pull** button in Source Control panel
2. Latest changes will be downloaded and merged
3. Your project is now up to date!

## UI Components

### Source Control Panel

Located in the right sidebar, the Source Control panel provides:

- **Header Section**
  - Current branch name
  - Refresh button
  - GitHub authentication status

- **Actions**
  - Pull: Download latest changes
  - Push: Upload your commits
  - Branch switcher

- **Changes Section**
  - Staged changes (ready to commit)
  - Unstaged changes (modified files)
  - File status icons

- **Commit Section**
  - Commit message input
  - Commit button with staged file count

### Diff Viewer

View detailed file changes:

- Green background: Added lines
- Red background: Removed lines
- Gray: Unchanged context
- Line numbers for easy reference

## API Reference

### Git Operations

```typescript
// Initialize Git repository
await window.api.invoke('Git.Initialize', { projectPath });

// Get repository status
const { files } = await window.api.invoke('Git.GetStatus');

// Stage files
await window.api.invoke('Git.StageFiles', { files: ['main.tex'] });

// Commit changes
await window.api.invoke('Git.Commit', { message: 'Update introduction' });

// Push to remote
await window.api.invoke('Git.Push', { remote: 'origin', branch: 'main' });

// Pull from remote
await window.api.invoke('Git.Pull', { remote: 'origin', branch: 'main' });

// Create branch
await window.api.invoke('Git.CreateBranch', { name: 'feature', checkout: true });

// Get diff for file
const { diff } = await window.api.invoke('Git.GetDiff', { filePath: 'main.tex' });
```

### Inviting Collaborators

1. Sign in to GitHub
2. Publish the project or add a GitHub remote
3. Click **Invite People** in Source Control
4. Enter a GitHub username, choose a permission, and send the invite

### GitHub Operations

```typescript
// Authenticate with GitHub
const { user } = await window.api.invoke('GitHub.Authenticate', { 
  token: 'ghp_...' 
});

// Start browser sign-in
const { session } = await window.api.invoke('GitHub.StartBrowserAuth');
const { user } = await window.api.invoke('GitHub.CompleteBrowserAuth', session);

// Get repositories
const { repos } = await window.api.invoke('GitHub.GetRepositories');

// Create repository
const { repo } = await window.api.invoke('GitHub.CreateRepository', {
  name: 'my-repo',
  description: 'My LaTeX project',
  isPrivate: false
});

// Create pull request
const { pr } = await window.api.invoke('GitHub.CreatePullRequest', {
  owner: 'username',
  repo: 'repo-name',
  title: 'Update chapter 1',
  head: 'feature-branch',
  base: 'main',
  body: 'Description of changes'
});

// Invite collaborator
const { invite } = await window.api.invoke('GitHub.InviteCollaborator', {
  owner: 'username',
  repo: 'repo-name',
  username: 'collaborator-login',
  permission: 'push'
});

// Sign out
await window.api.invoke('GitHub.SignOut');
```

## Collaborative Workflows

### Working with Others

1. **Clone a Repository**
   ```bash
   git clone https://github.com/username/latex-project.git
   ```

2. **Create a Feature Branch**
   - In Source Control, create a new branch
   - Make your changes
   - Commit regularly

3. **Push Your Branch**
   - Click Push in Source Control
   - Your branch appears on GitHub

4. **Create Pull Request**
   - Use GitHub.CreatePullRequest API
   - Team members can review
   - Merge when approved

### Handling Conflicts

1. Pull latest changes
2. If conflicts occur, conflicted files are marked ⚠️
3. Manually resolve conflicts in the editor
4. Stage resolved files
5. Commit the merge

## Security Best Practices

- **Never commit sensitive data** (API keys, passwords)
- Use `.gitignore` to exclude:
  - Build artifacts (`*.aux`, `*.log`, `*.pdf`)
  - Temporary files
  - Personal settings
- Keep your Personal Access Token secure
- Revoke tokens you no longer need
- Use separate tokens for different purposes

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Toggle Source Control | Click icon |
| Refresh Status | Refresh button |
| Stage All | "Stage All" button |
| Commit | Enter in message + Commit button |

## Troubleshooting

### Git Not Found

**Problem**: "Git not initialized" error

**Solution**: Install Git on your system
```bash
# macOS
brew install git

# Ubuntu/Debian
sudo apt-get install git

# Windows
# Download from git-scm.com
```

### Authentication Failed

**Problem**: GitHub authentication fails

**Solutions**:
1. Verify your token has `repo` scope
2. Check token hasn't expired
3. Generate a new token
4. Ensure token is copied correctly (no extra spaces)

### Push/Pull Failed

**Problem**: Unable to push or pull

**Solutions**:
1. Check internet connection
2. Verify remote URL is correct
3. Ensure you have push permissions
4. Check if branch tracking is set up

### Merge Conflicts

**Problem**: Conflicted files after pull

**Solutions**:
1. Identify conflicted files (⚠️ icon)
2. Open and manually resolve conflicts
3. Remove conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
4. Stage and commit resolved files

## File Structure

```
src/
├── main/
│   └── services/
│       ├── GitService.ts          # Git operations service
│       └── GitHubService.ts       # GitHub API integration
└── renderer/
    └── src/
        └── components/
            ├── SourceControl.tsx  # Main Source Control UI
            └── DiffViewer.tsx     # Diff visualization component
```

## Dependencies

- **simple-git**: Git operations from Node.js
- **@octokit/rest**: GitHub API client
- **lucide-react**: Icons for UI

## Future Enhancements

- [x] Browser-based GitHub authentication
- [x] Collaborator invitations
- [ ] Pull request inline review comments
- [ ] Blame/history view for files
- [ ] GitGraph visualization
- [ ] Stash management
- [ ] Submodule support
- [ ] GitHub Actions integration
- [ ] Collaborative real-time editing

## Support

For issues or questions:
- Open an issue on GitHub
- Check the [documentation](https://github.com/SrijitK10/AuroraTex)
- Join our community discussions

---

**Version**: 1.2.0  
**Last Updated**: September 2, 2025  
**Author**: AuroraTex Team
