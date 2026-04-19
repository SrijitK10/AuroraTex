import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  GitCommit, 
  GitPullRequest, 
  Upload, 
  Download, 
  RefreshCw, 
  Plus, 
  Minus,
  Check,
  X,
  Circle,
  AlertCircle,
  User,
  LogOut,
  Github,
  Users
} from 'lucide-react';

interface GitFile {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted';
  staged: boolean;
}

interface GitBranch {
  name: string;
  current: boolean;
  commit: string;
}

interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

interface GitRemote {
  name: string;
  url: string;
}

interface GitHubUser {
  login: string;
  name: string;
  email: string;
  avatarUrl: string;
}

interface GitHubBrowserAuthSession {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresAt: string;
  interval: number;
}

interface GitHubCollaborator {
  login: string;
  avatarUrl: string;
  permissions: Record<string, boolean>;
}

type CollaboratorPermission = 'pull' | 'triage' | 'push' | 'maintain' | 'admin';

export const SourceControl: React.FC = () => {
  const [files, setFiles] = useState<GitFile[]>([]);
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>('');
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [remotes, setRemotes] = useState<GitRemote[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gitInitialized, setGitInitialized] = useState(false);
  const [showBranches, setShowBranches] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  
  // GitHub state
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [githubToken, setGithubToken] = useState('');
  const [showGithubAuth, setShowGithubAuth] = useState(false);
  const [showTokenAuth, setShowTokenAuth] = useState(false);
  const [browserAuthSession, setBrowserAuthSession] = useState<GitHubBrowserAuthSession | null>(null);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [repoName, setRepoName] = useState('');
  const [repoDescription, setRepoDescription] = useState('');
  const [repoPrivate, setRepoPrivate] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [invitePermission, setInvitePermission] = useState<CollaboratorPermission>('push');
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<GitHubCollaborator[]>([]);

  useEffect(() => {
    checkGitStatus();
    checkGitHubAuth();
  }, []);

  const checkGitStatus = async () => {
    try {
      const projectPath = (window as any).currentProject?.root;
      if (!projectPath) return;

      const { success } = await window.electronAPI.invoke('Git.Initialize', { projectPath });
      setGitInitialized(success);

      if (success) {
        await refreshStatus();
        await refreshBranches();
        await refreshRemotes();
      }
    } catch (err) {
      console.error('Failed to check git status:', err);
    }
  };

  const checkGitHubAuth = async () => {
    try {
      const { authenticated } = await window.electronAPI.invoke('GitHub.IsAuthenticated');
      if (authenticated) {
        const { user } = await window.electronAPI.invoke('GitHub.GetCurrentUser');
        setGithubUser(user);
      }
    } catch (err) {
      console.error('Failed to check GitHub auth:', err);
    }
  };

  const getGitHubRemote = () => {
    return remotes.find(remote => remote.url.includes('github.com')) || null;
  };

  const resolveGitHubRepo = async () => {
    const remote = getGitHubRemote();

    if (!remote) {
      throw new Error('Add a GitHub remote before inviting collaborators.');
    }

    const { parsed } = await window.electronAPI.invoke('GitHub.ParseUrl', { url: remote.url });

    if (!parsed) {
      throw new Error('Could not read the GitHub owner and repository from the remote URL.');
    }

    return parsed as { owner: string; repo: string };
  };

  const refreshCollaborators = async () => {
    if (!githubUser || !getGitHubRemote()) return;

    try {
      const repo = await resolveGitHubRepo();
      const { collaborators: repoCollaborators } = await window.electronAPI.invoke('GitHub.GetCollaborators', repo);
      setCollaborators(repoCollaborators);
    } catch (err) {
      console.error('Failed to refresh GitHub collaborators:', err);
    }
  };

  const refreshStatus = async () => {
    try {
      const { files: gitFiles } = await window.electronAPI.invoke('Git.GetStatus');
      setFiles(gitFiles);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const refreshBranches = async () => {
    try {
      const { branches: gitBranches } = await window.electronAPI.invoke('Git.GetBranches');
      setBranches(gitBranches);
      const current = gitBranches.find((b: GitBranch) => b.current);
      if (current) setCurrentBranch(current.name);
    } catch (err: any) {
      console.error('Failed to refresh branches:', err);
    }
  };

  const refreshRemotes = async () => {
    try {
      const { remotes: gitRemotes } = await window.electronAPI.invoke('Git.GetRemotes');
      setRemotes(gitRemotes);
    } catch (err: any) {
      console.error('Failed to refresh remotes:', err);
    }
  };

  const refreshHistory = async () => {
    try {
      const { log } = await window.electronAPI.invoke('Git.GetLog', { maxCount: 50 });
      setCommits(log);
    } catch (err: any) {
      console.error('Failed to refresh history:', err);
    }
  };

  const handleInitRepository = async () => {
    try {
      setLoading(true);
      const projectPath = (window as any).currentProject?.root;
      await window.electronAPI.invoke('Git.InitRepository', { projectPath });
      setGitInitialized(true);
      await checkGitStatus();
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStageFile = async (file: GitFile) => {
    try {
      await window.electronAPI.invoke('Git.StageFiles', { files: [file.path] });
      await refreshStatus();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUnstageFile = async (file: GitFile) => {
    try {
      await window.electronAPI.invoke('Git.UnstageFiles', { files: [file.path] });
      await refreshStatus();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleStageAll = async () => {
    try {
      const unstagedFiles = files.filter(f => !f.staged).map(f => f.path);
      if (unstagedFiles.length > 0) {
        await window.electronAPI.invoke('Git.StageFiles', { files: unstagedFiles });
        await refreshStatus();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      setError('Commit message is required');
      return;
    }

    try {
      setLoading(true);
      await window.electronAPI.invoke('Git.Commit', { message: commitMessage });
      setCommitMessage('');
      await refreshStatus();
      await refreshHistory();
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async () => {
    try {
      setLoading(true);
      await window.electronAPI.invoke('Git.Push', { remote: 'origin' });
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePull = async () => {
    try {
      setLoading(true);
      await window.electronAPI.invoke('Git.Pull', { remote: 'origin' });
      await refreshStatus();
      await refreshHistory();
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;

    try {
      setLoading(true);
      await window.electronAPI.invoke('Git.CreateBranch', { 
        name: newBranchName, 
        checkout: true 
      });
      setNewBranchName('');
      await refreshBranches();
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckoutBranch = async (branchName: string) => {
    try {
      setLoading(true);
      await window.electronAPI.invoke('Git.CheckoutBranch', { name: branchName });
      await refreshBranches();
      await refreshStatus();
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubBrowserLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      const { session } = await window.electronAPI.invoke('GitHub.StartBrowserAuth');
      setBrowserAuthSession(session);

      const { user } = await window.electronAPI.invoke('GitHub.CompleteBrowserAuth', {
        deviceCode: session.deviceCode,
        interval: session.interval,
        expiresAt: session.expiresAt
      });

      setGithubUser(user);
      setShowGithubAuth(false);
      setBrowserAuthSession(null);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubTokenLogin = async () => {
    if (!githubToken.trim()) {
      setError('GitHub token is required');
      return;
    }

    try {
      setLoading(true);
      const { user } = await window.electronAPI.invoke('GitHub.Authenticate', { token: githubToken });
      setGithubUser(user);
      setGithubToken('');
      setShowGithubAuth(false);
      setShowTokenAuth(false);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubLogout = async () => {
    try {
      await window.electronAPI.invoke('GitHub.SignOut');
      setGithubUser(null);
      setCollaborators([]);
      setShowInviteDialog(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleInviteCollaborator = async () => {
    if (!inviteUsername.trim()) {
      setError('GitHub username is required');
      return;
    }

    try {
      setLoading(true);
      setInviteMessage(null);
      const repo = await resolveGitHubRepo();
      const { invite } = await window.electronAPI.invoke('GitHub.InviteCollaborator', {
        ...repo,
        username: inviteUsername.trim(),
        permission: invitePermission
      });

      setInviteMessage(
        invite.status === 'already_collaborator'
          ? `${invite.username} already has access to this repository.`
          : `Invitation sent to ${invite.username}.`
      );
      setInviteUsername('');
      await refreshCollaborators();
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePublishToGitHub = async () => {
    if (!repoName.trim()) {
      setError('Repository name is required');
      return;
    }

    try {
      setLoading(true);
      
      // Create repository on GitHub
      const { repo } = await window.electronAPI.invoke('GitHub.CreateRepository', {
        name: repoName,
        description: repoDescription,
        isPrivate: repoPrivate
      });

      // Add remote
      await window.electronAPI.invoke('Git.AddRemote', {
        name: 'origin',
        url: repo.cloneUrl
      });

      // Pull first to get the initial commit from GitHub (auto_init creates README)
      try {
        await window.electronAPI.invoke('Git.Pull', { 
          remote: 'origin',
          branch: repo.defaultBranch || 'main'
        });
      } catch (pullErr) {
        console.log('Pull failed (expected if repository is empty):', pullErr);
      }

      // Push to GitHub with upstream
      await window.electronAPI.invoke('Git.Push', { 
        remote: 'origin',
        branch: currentBranch || 'main',
        setUpstream: true
      });

      setShowPublishDialog(false);
      setRepoName('');
      setRepoDescription('');
      await refreshRemotes();
      await refreshCollaborators();
      setError(null);
      
      // Show success message
      alert(`Repository published successfully to GitHub!\n${repo.url}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'modified': return <Circle className="w-3 h-3 text-orange-500 fill-orange-500" />;
      case 'added': return <Plus className="w-3 h-3 text-green-500" />;
      case 'deleted': return <Minus className="w-3 h-3 text-red-500" />;
      case 'untracked': return <Circle className="w-3 h-3 text-blue-500 fill-blue-500" />;
      case 'conflicted': return <AlertCircle className="w-3 h-3 text-red-500" />;
      default: return null;
    }
  };

  if (!gitInitialized) {
    return (
      <div className="flex flex-col h-full bg-gray-900 text-gray-100 p-4">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <GitBranch className="w-5 h-5" />
          Source Control
        </h2>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400 mb-4">This project is not a Git repository</p>
            <button
              onClick={handleInitRepository}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Initializing...' : 'Initialize Repository'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const stagedFiles = files.filter(f => f.staged);
  const unstagedFiles = files.filter(f => !f.staged);
  const githubRemote = getGitHubRemote();

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            Source Control
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => refreshStatus()}
              className="p-1.5 hover:bg-gray-700 rounded"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Current Branch */}
        <div className="flex items-center gap-2 text-sm mb-3">
          <GitBranch className="w-4 h-4" />
          <button
            onClick={() => setShowBranches(!showBranches)}
            className="flex-1 text-left px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded"
          >
            {currentBranch || 'main'}
          </button>
        </div>

        {/* GitHub User */}
        {githubUser ? (
          <div className="flex items-center gap-2 text-sm bg-gray-800 rounded p-2">
            <img src={githubUser.avatarUrl} className="w-6 h-6 rounded-full" alt={githubUser.login} />
            <span className="flex-1">{githubUser.login}</span>
            <button
              onClick={handleGitHubLogout}
              className="p-1 hover:bg-gray-700 rounded"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowGithubAuth(!showGithubAuth)}
            className="w-full text-sm px-2 py-1.5 bg-gray-800 hover:bg-gray-700 rounded flex items-center gap-2"
          >
            <User className="w-4 h-4" />
            Sign in to GitHub
          </button>
        )}

        {/* GitHub Auth */}
        {showGithubAuth && !githubUser && (
          <div className="mt-2 p-3 bg-gray-800 rounded">
            <button
              onClick={handleGitHubBrowserLogin}
              disabled={loading}
              className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Github className="w-4 h-4" />
              {loading && browserAuthSession ? 'Waiting for GitHub...' : 'Continue with GitHub'}
            </button>

            {browserAuthSession && (
              <div className="mt-3 p-2 bg-gray-900 rounded text-xs text-gray-300">
                <div className="text-gray-400 mb-1">Browser opened. Enter this code on GitHub:</div>
                <div className="font-mono text-base tracking-widest text-white">{browserAuthSession.userCode}</div>
              </div>
            )}

            <button
              onClick={() => setShowTokenAuth(!showTokenAuth)}
              className="w-full mt-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              {showTokenAuth ? 'Hide token sign in' : 'Use personal access token'}
            </button>

            {showTokenAuth && (
              <div className="mt-2">
                <input
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  className="w-full px-2 py-1 mb-2 bg-gray-900 border border-gray-700 rounded text-sm"
                  placeholder="ghp_..."
                />
              </div>
            )}

            <div className="flex gap-2">
              {showTokenAuth && (
                <button
                  onClick={handleGitHubTokenLogin}
                  disabled={loading || !githubToken.trim()}
                  className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm disabled:opacity-50"
                >
                  Sign In
                </button>
              )}
              <button
                onClick={() => {
                  setShowGithubAuth(false);
                  setBrowserAuthSession(null);
                }}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={handlePull}
            disabled={loading || remotes.length === 0}
            className="flex-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded flex items-center justify-center gap-1.5 text-sm disabled:opacity-50"
            title="Pull"
          >
            <Download className="w-4 h-4" />
            Pull
          </button>
          <button
            onClick={handlePush}
            disabled={loading || remotes.length === 0}
            className="flex-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded flex items-center justify-center gap-1.5 text-sm disabled:opacity-50"
            title="Push"
          >
            <Upload className="w-4 h-4" />
            Push
          </button>
        </div>

        {/* Publish to GitHub */}
        {githubUser && remotes.length === 0 && (
          <button
            onClick={() => setShowPublishDialog(true)}
            className="w-full mt-2 px-3 py-2 bg-green-600 hover:bg-green-700 rounded flex items-center justify-center gap-2 text-sm"
          >
            <Upload className="w-4 h-4" />
            Publish to GitHub
          </button>
        )}

        {/* Invite Collaborators */}
        {githubUser && githubRemote && (
          <button
            onClick={async () => {
              setShowInviteDialog(!showInviteDialog);
              setInviteMessage(null);
              if (!showInviteDialog) {
                await refreshCollaborators();
              }
            }}
            className="w-full mt-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded flex items-center justify-center gap-2 text-sm"
          >
            <Users className="w-4 h-4" />
            Invite People
          </button>
        )}

        {/* Invite Dialog */}
        {showInviteDialog && githubUser && githubRemote && (
          <div className="mt-2 p-3 bg-gray-800 rounded">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Invite People</h3>
              <button
                onClick={() => setShowInviteDialog(false)}
                className="p-1 hover:bg-gray-700 rounded"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-400 block mb-1">GitHub Username</label>
                <input
                  type="text"
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  className="w-full px-2 py-1 bg-gray-900 border border-gray-700 rounded text-sm"
                  placeholder="octocat"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Permission</label>
                <select
                  value={invitePermission}
                  onChange={(e) => setInvitePermission(e.target.value as CollaboratorPermission)}
                  className="w-full px-2 py-1 bg-gray-900 border border-gray-700 rounded text-sm"
                >
                  <option value="pull">Read</option>
                  <option value="triage">Triage</option>
                  <option value="push">Write</option>
                  <option value="maintain">Maintain</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                onClick={handleInviteCollaborator}
                disabled={loading || !inviteUsername.trim()}
                className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Invite'}
              </button>

              {inviteMessage && (
                <div className="p-2 bg-green-900/30 border border-green-700 rounded text-xs text-green-300">
                  {inviteMessage}
                </div>
              )}

              {collaborators.length > 0 && (
                <div className="pt-2 border-t border-gray-700">
                  <div className="text-xs text-gray-400 mb-2">Current collaborators</div>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {collaborators.map((collaborator) => (
                      <div key={collaborator.login} className="flex items-center gap-2 text-sm">
                        <img src={collaborator.avatarUrl} className="w-5 h-5 rounded-full" alt={collaborator.login} />
                        <span className="truncate">{collaborator.login}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Publish Dialog */}
        {showPublishDialog && (
          <div className="mt-2 p-3 bg-gray-800 rounded">
            <h3 className="text-sm font-semibold mb-3">Publish to GitHub</h3>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Repository Name *</label>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  className="w-full px-2 py-1 bg-gray-900 border border-gray-700 rounded text-sm"
                  placeholder="my-repository"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Description</label>
                <input
                  type="text"
                  value={repoDescription}
                  onChange={(e) => setRepoDescription(e.target.value)}
                  className="w-full px-2 py-1 bg-gray-900 border border-gray-700 rounded text-sm"
                  placeholder="Repository description"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="private-repo"
                  checked={repoPrivate}
                  onChange={(e) => setRepoPrivate(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="private-repo" className="text-sm">Private repository</label>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handlePublishToGitHub}
                  disabled={loading || !repoName.trim()}
                  className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm disabled:opacity-50"
                >
                  {loading ? 'Publishing...' : 'Publish'}
                </button>
                <button
                  onClick={() => setShowPublishDialog(false)}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 p-2 bg-red-900/30 border border-red-700 rounded text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Branch List */}
      {showBranches && (
        <div className="mx-4 mt-3 bg-gray-800 rounded p-3">
          <h3 className="text-sm font-semibold mb-2">Branches</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto mb-3">
            {branches.map((branch) => (
              <button
                key={branch.name}
                onClick={() => handleCheckoutBranch(branch.name)}
                className={`w-full text-left px-2 py-1 rounded text-sm flex items-center gap-2 ${
                  branch.current
                    ? 'bg-blue-600'
                    : 'hover:bg-gray-700'
                }`}
              >
                {branch.current && <Check className="w-3 h-3" />}
                {branch.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              className="flex-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-sm"
              placeholder="New branch name"
            />
            <button
              onClick={handleCreateBranch}
              disabled={!newBranchName.trim()}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Commit Message */}
      {stagedFiles.length > 0 && (
        <div className="p-4 border-b border-gray-700">
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm resize-none"
            placeholder="Commit message"
            rows={3}
          />
          <button
            onClick={handleCommit}
            disabled={loading || !commitMessage.trim()}
            className="w-full mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <GitCommit className="w-4 h-4" />
            Commit ({stagedFiles.length})
          </button>
        </div>
      )}

      {/* Files */}
      <div className="flex-1 overflow-y-auto">
        {/* Staged Changes */}
        {stagedFiles.length > 0 && (
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-sm font-semibold mb-2 flex items-center justify-between">
              <span>Staged Changes ({stagedFiles.length})</span>
            </h3>
            <div className="space-y-1">
              {stagedFiles.map((file) => (
                <div
                  key={file.path}
                  className="flex items-center gap-2 p-2 hover:bg-gray-800 rounded group"
                >
                  {getStatusIcon(file.status)}
                  <span className="flex-1 text-sm truncate">{file.path}</span>
                  <button
                    onClick={() => handleUnstageFile(file)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded"
                    title="Unstage"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Changes */}
        {unstagedFiles.length > 0 && (
          <div className="p-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center justify-between">
              <span>Changes ({unstagedFiles.length})</span>
              <button
                onClick={handleStageAll}
                className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded"
              >
                Stage All
              </button>
            </h3>
            <div className="space-y-1">
              {unstagedFiles.map((file) => (
                <div
                  key={file.path}
                  className="flex items-center gap-2 p-2 hover:bg-gray-800 rounded group"
                >
                  {getStatusIcon(file.status)}
                  <span className="flex-1 text-sm truncate">{file.path}</span>
                  <button
                    onClick={() => handleStageFile(file)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded"
                    title="Stage"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Changes */}
        {files.length === 0 && (
          <div className="p-4 text-center text-gray-400 text-sm">
            No changes
          </div>
        )}
      </div>
    </div>
  );
};
