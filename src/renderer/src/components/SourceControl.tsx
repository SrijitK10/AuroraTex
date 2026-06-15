import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  AlertCircle,
  LogOut,
  Github,
  Users,
  ChevronDown,
  ChevronRight,
  Undo2,
  Key,
  Archive,
  GitMerge,
  Loader2,
  CloudDownload,
  Trash2,
  Eye,
  CheckCircle2,
} from 'lucide-react';

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface GitFile {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted';
  staged: boolean;
}

interface GitBranchInfo {
  name: string;
  current: boolean;
  commit: string;
}

interface GitCommitEntry {
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

interface StashEntry {
  index: number;
  message: string;
}

// ─── Toast notification ──────────────────────────────────────────────────────

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
  id: number;
}

const Toast: React.FC<{ toast: ToastState; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const colors = {
    success: 'bg-green-600/90 text-white',
    error: 'bg-red-600/90 text-white',
    info: 'bg-blue-600/90 text-white',
  };

  const icons = {
    success: <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0 }} />,
    error: <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />,
    info: <RefreshCw style={{ width: 14, height: 14, flexShrink: 0 }} />,
  };

  return (
    <div
      className={`${colors[toast.type]} animate-in slide-in-from-top-2`}
      style={{
        padding: '8px 12px',
        borderRadius: 8,
        fontSize: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        animation: 'slideIn 200ms ease-out',
      }}
    >
      {icons[toast.type]}
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        onClick={onDismiss}
        style={{ padding: 2, border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit', display: 'flex' }}
      >
        <X style={{ width: 12, height: 12 }} />
      </button>
    </div>
  );
};

// ─── Inline Diff Viewer ──────────────────────────────────────────────────────

const InlineDiff: React.FC<{ diff: string; onClose: () => void }> = ({ diff, onClose }) => {
  const lines = diff.split('\n');
  return (
    <div className="bg-gray-950 border border-gray-700" style={{ borderRadius: 8, margin: '8px 0', maxHeight: 300, overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <span className="text-gray-400" style={{ fontSize: 11, fontWeight: 600 }}>Diff</span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300" style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', padding: 2 }}>
          <X style={{ width: 12, height: 12 }} />
        </button>
      </div>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, lineHeight: '18px' }} className="custom-scrollbar">
        {lines.map((line, i) => {
          let cls = 'text-gray-400';
          let bg = 'transparent';
          if (line.startsWith('+') && !line.startsWith('+++')) { cls = 'text-green-400'; bg = 'rgba(22,163,74,0.1)'; }
          else if (line.startsWith('-') && !line.startsWith('---')) { cls = 'text-red-400'; bg = 'rgba(220,38,38,0.1)'; }
          else if (line.startsWith('@@')) { cls = 'text-blue-400'; bg = 'rgba(59,130,246,0.08)'; }
          else if (line.startsWith('diff') || line.startsWith('index')) { cls = 'text-gray-500'; }

          return (
            <div key={i} className={cls} style={{ padding: '0 10px', background: bg, whiteSpace: 'pre', minWidth: 'fit-content' }}>
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Spinner ─────────────────────────────────────────────────────────────────

const Spinner: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <Loader2 style={{ width: size, height: size, animation: 'spin 1s linear infinite' }} />
);

// ─── Section Header ──────────────────────────────────────────────────────────

const SectionHeader: React.FC<{
  title: string;
  count?: number;
  expanded: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
}> = ({ title, count, expanded, onToggle, actions }) => (
  <div
    className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50"
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 16px',
      cursor: 'pointer',
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      userSelect: 'none',
    }}
    onClick={onToggle}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {expanded ? <ChevronDown style={{ width: 12, height: 12 }} /> : <ChevronRight style={{ width: 12, height: 12 }} />}
      <span>{title}</span>
      {count !== undefined && count > 0 && (
        <span className="text-gray-400 dark:text-gray-500" style={{ fontWeight: 400, fontSize: 10 }}>
          ({count})
        </span>
      )}
    </div>
    {actions && <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 4 }}>{actions}</div>}
  </div>
);

// ─── Tiny icon button ────────────────────────────────────────────────────────

const IconBtn: React.FC<{
  onClick: (e: React.MouseEvent) => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}> = ({ onClick, title, children, className = '', disabled = false }) => (
  <button
    onClick={onClick}
    title={title}
    disabled={disabled}
    className={`text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30 ${className}`}
    style={{ padding: 2, border: 'none', background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', transition: 'opacity 150ms' }}
  >
    {children}
  </button>
);

// ─── Status Badge ────────────────────────────────────────────────────────────

const statusBadges: Record<string, { label: string; color: string; bg: string }> = {
  modified: { label: 'M', color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
  added: { label: 'A', color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
  deleted: { label: 'D', color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
  untracked: { label: 'U', color: '#2563eb', bg: 'rgba(37,99,235,0.1)' },
  renamed: { label: 'R', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  conflicted: { label: '!', color: '#dc2626', bg: 'rgba(220,38,38,0.15)' },
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const badge = statusBadges[status] || { label: '?', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' };
  return (
    <span
      style={{
        fontSize: 10, fontWeight: 700, fontFamily: 'ui-monospace, monospace',
        color: badge.color, background: badge.bg, borderRadius: 3,
        padding: '1px 5px', lineHeight: '16px', flexShrink: 0,
      }}
    >
      {badge.label}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export const SourceControl: React.FC<{ projectRoot: string }> = ({ projectRoot }) => {
  // ─── State ─────────────────────────────────────────────────────────────
  const [files, setFiles] = useState<GitFile[]>([]);
  const [branches, setBranches] = useState<GitBranchInfo[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>('');
  const [commits, setCommits] = useState<GitCommitEntry[]>([]);
  const [remotes, setRemotes] = useState<GitRemote[]>([]);
  const [stashes, setStashes] = useState<StashEntry[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [opLoading, setOpLoading] = useState<string | null>(null); // per-operation loading
  const [gitInitialized, setGitInitialized] = useState(false);

  // Section toggles
  const [expandStaged, setExpandStaged] = useState(true);
  const [expandChanges, setExpandChanges] = useState(true);
  const [expandBranches, setExpandBranches] = useState(false);
  const [expandHistory, setExpandHistory] = useState(false);
  const [expandStash, setExpandStash] = useState(false);

  // Branch UI
  const [newBranchName, setNewBranchName] = useState('');

  // GitHub state
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [browserAuthSession, setBrowserAuthSession] = useState<GitHubBrowserAuthSession | null>(null);
  const [browserAuthAvailable, setBrowserAuthAvailable] = useState(true);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenValue, setTokenValue] = useState('');
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [repoName, setRepoName] = useState('');
  const [repoDescription, setRepoDescription] = useState('');
  const [repoPrivate, setRepoPrivate] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [invitePermission, setInvitePermission] = useState<CollaboratorPermission>('push');
  const [collaborators, setCollaborators] = useState<GitHubCollaborator[]>([]);

  // Diff viewer
  const [diffFile, setDiffFile] = useState<{ path: string; staged: boolean } | null>(null);
  const [diffContent, setDiffContent] = useState<string>('');

  // Toasts
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastId = useRef(0);

  // ─── Toast helpers ─────────────────────────────────────────────────────

  const showToast = useCallback((message: string, type: ToastState['type'] = 'info') => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev.slice(-2), { message, type, id }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ─── Data fetchers ─────────────────────────────────────────────────────

  const refreshStatus = useCallback(async () => {
    try {
      const { files: gitFiles } = await window.electronAPI.invoke('Git.GetStatus');
      setFiles(gitFiles || []);
    } catch (err: any) {
      console.error('Failed to refresh status:', err);
    }
  }, []);

  const refreshBranches = useCallback(async () => {
    try {
      const { branches: gitBranches } = await window.electronAPI.invoke('Git.GetBranches');
      setBranches(gitBranches || []);
      const current = (gitBranches || []).find((b: GitBranchInfo) => b.current);
      if (current) setCurrentBranch(current.name);
    } catch (err) {
      console.error('Failed to refresh branches:', err);
    }
  }, []);

  const refreshRemotes = useCallback(async () => {
    try {
      const { remotes: gitRemotes } = await window.electronAPI.invoke('Git.GetRemotes');
      setRemotes(gitRemotes || []);
    } catch (err) {
      console.error('Failed to refresh remotes:', err);
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      const { log } = await window.electronAPI.invoke('Git.GetLog', { maxCount: 50 });
      setCommits(log || []);
    } catch (err) {
      console.error('Failed to refresh history:', err);
    }
  }, []);

  const refreshStashes = useCallback(async () => {
    try {
      const { stashes: list } = await window.electronAPI.invoke('Git.StashList');
      setStashes(list || []);
    } catch (err) {
      console.error('Failed to refresh stashes:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshStatus(), refreshBranches(), refreshRemotes()]);
  }, [refreshStatus, refreshBranches, refreshRemotes]);

  // ─── Git initialization ────────────────────────────────────────────────

  const checkGitStatus = useCallback(async () => {
    try {
      const projectPath = projectRoot;
      if (!projectPath) return;

      const { success } = await window.electronAPI.invoke('Git.Initialize', { projectPath });
      setGitInitialized(success);

      if (success) {
        await refreshAll();
      }
    } catch (err) {
      console.error('Failed to check git status:', err);
    }
  }, [refreshAll, projectRoot]);

  const checkGitHubAuth = useCallback(async () => {
    try {
      const { authenticated } = await window.electronAPI.invoke('GitHub.IsAuthenticated');
      if (authenticated) {
        const { user } = await window.electronAPI.invoke('GitHub.GetCurrentUser');
        setGithubUser(user);
      }
      // Check if browser auth is available
      try {
        const { available } = await window.electronAPI.invoke('GitHub.IsBrowserAuthAvailable');
        setBrowserAuthAvailable(available);
      } catch {
        setBrowserAuthAvailable(false);
      }
    } catch (err) {
      console.error('Failed to check GitHub auth:', err);
    }
  }, []);

  useEffect(() => {
    checkGitStatus();
    checkGitHubAuth();
  }, [checkGitStatus, checkGitHubAuth]);

  // Auto-refresh on window focus
  useEffect(() => {
    const onFocus = () => {
      if (gitInitialized) refreshStatus();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [gitInitialized, refreshStatus]);

  // ─── GitHub helpers ────────────────────────────────────────────────────

  const getGitHubRemote = () => remotes.find((r) => r.url.includes('github.com')) || null;

  const resolveGitHubRepo = async () => {
    const remote = getGitHubRemote();
    if (!remote) throw new Error('Add a GitHub remote before this operation.');
    const { parsed } = await window.electronAPI.invoke('GitHub.ParseUrl', { url: remote.url });
    if (!parsed) throw new Error('Could not parse GitHub owner/repo from remote URL.');
    return parsed as { owner: string; repo: string };
  };

  const refreshCollaborators = async () => {
    if (!githubUser || !getGitHubRemote()) return;
    try {
      const repo = await resolveGitHubRepo();
      const { collaborators: list } = await window.electronAPI.invoke('GitHub.GetCollaborators', repo);
      setCollaborators(list || []);
    } catch (err) {
      console.error('Failed to refresh collaborators:', err);
    }
  };

  // ─── Diff viewer ──────────────────────────────────────────────────────

  const showDiff = async (path: string, staged: boolean) => {
    try {
      const { diff } = await window.electronAPI.invoke('Git.GetFileDiff', { filePath: path, staged });
      setDiffFile({ path, staged });
      setDiffContent(diff || '(no diff available)');
    } catch (err: any) {
      showToast(err.message || 'Failed to load diff', 'error');
    }
  };

  // ─── Git operations ───────────────────────────────────────────────────

  const handleInitRepository = async () => {
    try {
      setLoading(true);
      const projectPath = projectRoot;
      await window.electronAPI.invoke('Git.InitRepository', { projectPath });
      setGitInitialized(true);
      await checkGitStatus();
      showToast('Repository initialized', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStageFile = async (file: GitFile) => {
    try {
      await window.electronAPI.invoke('Git.StageFiles', { files: [file.path] });
      await refreshStatus();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleUnstageFile = async (file: GitFile) => {
    try {
      await window.electronAPI.invoke('Git.UnstageFiles', { files: [file.path] });
      await refreshStatus();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleStageAll = async () => {
    try {
      await window.electronAPI.invoke('Git.StageAll');
      await refreshStatus();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDiscardFile = async (file: GitFile) => {
    const confirmed = window.confirm(`Discard changes in "${file.path}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await window.electronAPI.invoke('Git.DiscardChanges', { files: [file.path] });
      await refreshStatus();
      showToast(`Discarded changes in ${file.path}`, 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      showToast('Commit message is required', 'error');
      return;
    }

    try {
      setOpLoading('commit');
      await window.electronAPI.invoke('Git.Commit', { message: commitMessage });
      setCommitMessage('');
      await refreshStatus();
      await refreshBranches();
      if (expandHistory) await refreshHistory();
      showToast('Changes committed', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setOpLoading(null);
    }
  };

  const handlePush = async () => {
    try {
      setOpLoading('push');
      let branch = currentBranch;
      if (!branch) {
        try {
          const { branch: b } = await window.electronAPI.invoke('Git.GetCurrentBranch');
          branch = b;
        } catch {}
      }

      // Auto set-upstream if this is a new branch
      await window.electronAPI.invoke('Git.Push', {
        remote: 'origin',
        branch: branch || 'master',
        setUpstream: true,
      });
      showToast('Pushed to remote', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setOpLoading(null);
    }
  };

  const handlePull = async () => {
    try {
      setOpLoading('pull');
      let branch = currentBranch;
      if (!branch) {
        try {
          const { branch: b } = await window.electronAPI.invoke('Git.GetCurrentBranch');
          branch = b;
        } catch {}
      }

      await window.electronAPI.invoke('Git.Pull', {
        remote: 'origin',
        branch: branch || 'master',
      });
      await refreshStatus();
      if (expandHistory) await refreshHistory();
      showToast('Pulled from remote', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setOpLoading(null);
    }
  };

  const handleFetch = async () => {
    try {
      setOpLoading('fetch');
      await window.electronAPI.invoke('Git.Fetch', {});
      showToast('Fetched from remote', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setOpLoading(null);
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    try {
      setLoading(true);
      await window.electronAPI.invoke('Git.CreateBranch', { name: newBranchName, checkout: true });
      setNewBranchName('');
      await refreshBranches();
      await refreshStatus();
      showToast(`Created and switched to branch "${newBranchName}"`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
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
      showToast(`Switched to "${branchName}"`, 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBranch = async (branchName: string) => {
    const confirmed = window.confirm(`Delete branch "${branchName}"?`);
    if (!confirmed) return;
    try {
      await window.electronAPI.invoke('Git.DeleteBranch', { name: branchName, force: false });
      await refreshBranches();
      showToast(`Deleted branch "${branchName}"`, 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleMergeBranch = async (branchName: string) => {
    const confirmed = window.confirm(`Merge "${branchName}" into "${currentBranch}"?`);
    if (!confirmed) return;
    try {
      setLoading(true);
      await window.electronAPI.invoke('Git.Merge', { branch: branchName });
      await refreshStatus();
      await refreshBranches();
      if (expandHistory) await refreshHistory();
      showToast(`Merged "${branchName}" into "${currentBranch}"`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ─── Stash operations ─────────────────────────────────────────────────

  const handleStash = async () => {
    try {
      await window.electronAPI.invoke('Git.Stash', { message: `Stash from ${currentBranch}` });
      await refreshStatus();
      await refreshStashes();
      showToast('Changes stashed', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleStashPop = async (index?: number) => {
    try {
      await window.electronAPI.invoke('Git.StashPop', { index });
      await refreshStatus();
      await refreshStashes();
      showToast('Stash applied and removed', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleStashDrop = async (index: number) => {
    const confirmed = window.confirm('Drop this stash entry? This cannot be undone.');
    if (!confirmed) return;
    try {
      await window.electronAPI.invoke('Git.StashDrop', { index });
      await refreshStashes();
      showToast('Stash entry dropped', 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // ─── GitHub auth ──────────────────────────────────────────────────────

  const handleGitHubBrowserLogin = async () => {
    try {
      setLoading(true);
      const { session } = await window.electronAPI.invoke('GitHub.StartBrowserAuth');
      setBrowserAuthSession(session);

      const { user } = await window.electronAPI.invoke('GitHub.CompleteBrowserAuth', {
        deviceCode: session.deviceCode,
        interval: session.interval,
        expiresAt: session.expiresAt,
      });

      setGithubUser(user);
      setBrowserAuthSession(null);
      showToast(`Signed in as ${user.login}`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
      setBrowserAuthSession(null);
    } finally {
      setLoading(false);
    }
  };

  const handleTokenLogin = async () => {
    if (!tokenValue.trim()) {
      showToast('Token cannot be empty', 'error');
      return;
    }
    try {
      setLoading(true);
      const { user } = await window.electronAPI.invoke('GitHub.Authenticate', { token: tokenValue });
      setGithubUser(user);
      setTokenValue('');
      setShowTokenInput(false);
      showToast(`Signed in as ${user.login}`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
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
      showToast('Signed out of GitHub', 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // ─── Publish to GitHub ────────────────────────────────────────────────

  const handlePublishToGitHub = async () => {
    if (!repoName.trim()) {
      showToast('Repository name is required', 'error');
      return;
    }

    try {
      setOpLoading('publish');

      // Stage all files first
      await window.electronAPI.invoke('Git.StageAll');

      // Check if there are existing commits
      let hasCommits = false;
      try {
        const { log } = await window.electronAPI.invoke('Git.GetLog', { maxCount: 1 });
        hasCommits = log && log.length > 0;
      } catch { hasCommits = false; }

      // Check if there are staged changes to commit
      const { files: currentFiles } = await window.electronAPI.invoke('Git.GetStatus');
      const hasStagedChanges = currentFiles?.some((f: GitFile) => f.staged);

      if (!hasCommits) {
        if (hasStagedChanges) {
          await window.electronAPI.invoke('Git.Commit', { message: 'Initial commit' });
        } else {
          showToast('No files to commit. Add files first.', 'error');
          setOpLoading(null);
          return;
        }
      } else if (hasStagedChanges) {
        await window.electronAPI.invoke('Git.Commit', { message: 'Publish to GitHub' });
      }

      // Get the ACTUAL branch name — it could be 'main' or 'master' depending
      // on the user's git config.  We cannot assume 'main'.
      let branch = 'main';
      try {
        const { branch: realBranch } = await window.electronAPI.invoke('Git.GetCurrentBranch');
        if (realBranch) branch = realBranch;
      } catch {
        // Fallback to 'main'
      }

      // Create the GitHub repository
      const { repo } = await window.electronAPI.invoke('GitHub.CreateRepository', {
        name: repoName,
        description: repoDescription,
        isPrivate: repoPrivate,
      });

      // Add remote and push
      await window.electronAPI.invoke('Git.AddRemote', { name: 'origin', url: repo.cloneUrl });
      await refreshRemotes(); // Refresh immediately so UI updates even if push fails
      await window.electronAPI.invoke('Git.Push', { remote: 'origin', branch, setUpstream: true });

      setShowPublishDialog(false);
      setRepoName('');
      setRepoDescription('');
      await refreshRemotes();
      await refreshStatus();
      await refreshBranches();
      showToast(`Published to ${repo.url}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to publish to GitHub', 'error');
    } finally {
      setOpLoading(null);
    }
  };

  // ─── Invite collaborator ──────────────────────────────────────────────

  const handleInviteCollaborator = async () => {
    if (!inviteUsername.trim()) {
      showToast('GitHub username is required', 'error');
      return;
    }
    try {
      setLoading(true);
      const repo = await resolveGitHubRepo();
      const { invite } = await window.electronAPI.invoke('GitHub.InviteCollaborator', {
        ...repo,
        username: inviteUsername.trim(),
        permission: invitePermission,
      });
      showToast(
        invite.status === 'already_collaborator'
          ? `${invite.username} already has access.`
          : `Invitation sent to ${invite.username}.`,
        'success'
      );
      setInviteUsername('');
      await refreshCollaborators();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ─── Keyboard shortcuts ───────────────────────────────────────────────

  const handleCommitKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleCommit().then(() => {
        if (remotes.length > 0) handlePush();
      });
    } else if (e.key === 'Enter' && !e.shiftKey) {
      // Allow Shift+Enter for new lines
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ─── RENDER ────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  const stagedFiles = files.filter((f) => f.staged);
  const unstagedFiles = files.filter((f) => !f.staged);
  const githubRemote = getGitHubRemote();

  // Not initialized
  if (!gitInitialized) {
    return (
      <div className="flex flex-col h-full text-gray-900 dark:text-gray-100" style={{ padding: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <GitBranch style={{ width: 16, height: 16 }} />
          Source Control
        </h2>
        <div className="flex-1 flex items-center justify-center">
          <div style={{ textAlign: 'center' }}>
            <p className="text-gray-500 dark:text-gray-400" style={{ fontSize: 13, marginBottom: 16 }}>
              This project is not a Git repository
            </p>
            <button
              onClick={handleInitRepository}
              disabled={loading}
              className="minimal-button-primary disabled:opacity-50"
              style={{ fontSize: 13 }}
            >
              {loading ? 'Initializing...' : 'Initialize Repository'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full text-gray-900 dark:text-gray-100 custom-scrollbar" style={{ position: 'relative' }}>

      {/* ─── Toast container ──────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 8, left: 16, right: 16, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 6, pointerEvents: 'none' }}>
        {toasts.map((toast) => (
          <div key={toast.id} style={{ pointerEvents: 'auto' }}>
            <Toast toast={toast} onDismiss={() => dismissToast(toast.id)} />
          </div>
        ))}
      </div>

      {/* ─── Header ──────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: '12px 16px', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}
           className="border-gray-200 dark:border-gray-800">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <GitBranch style={{ width: 16, height: 16 }} />
            Source Control
          </h2>
          <IconBtn onClick={() => refreshAll()} title="Refresh">
            <RefreshCw style={{ width: 14, height: 14 }} />
          </IconBtn>
        </div>

        {/* Branch selector */}
        <button
          onClick={() => { setExpandBranches(!expandBranches); if (!expandBranches) refreshBranches(); }}
          className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200"
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, textAlign: 'left' }}
        >
          <GitBranch style={{ width: 13, height: 13, flexShrink: 0 }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentBranch || 'main'}
          </span>
          <ChevronDown style={{ width: 12, height: 12, flexShrink: 0, opacity: 0.5, transform: expandBranches ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
        </button>

        {/* GitHub user / login */}
        <div style={{ marginTop: 12 }}>
          {githubUser ? (
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                 style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, fontSize: 12 }}>
              <img src={githubUser.avatarUrl} style={{ width: 20, height: 20, borderRadius: '50%' }} alt={githubUser.login} />
              <span className="text-gray-800 dark:text-gray-200" style={{ flex: 1, fontWeight: 500 }}>{githubUser.login}</span>
              <IconBtn onClick={handleGitHubLogout} title="Sign out">
                <LogOut style={{ width: 13, height: 13 }} />
              </IconBtn>
            </div>
          ) : browserAuthSession ? (
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700" style={{ padding: 12, borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 12, fontWeight: 600 }} className="text-gray-800 dark:text-gray-200">
                <Github style={{ width: 14, height: 14 }} /> GitHub Login
              </div>
              <p className="text-gray-500 dark:text-gray-400" style={{ fontSize: 11, marginBottom: 8 }}>
                A browser window has been opened. Enter this code:
              </p>
              <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700"
                   style={{ fontFamily: 'ui-monospace, monospace', textAlign: 'center', fontSize: 18, letterSpacing: '0.15em', padding: '8px 0', borderRadius: 6, fontWeight: 700 }}>
                {browserAuthSession.userCode}
              </div>
              <button
                onClick={() => { setBrowserAuthSession(null); setLoading(false); }}
                className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200"
                style={{ width: '100%', marginTop: 8, padding: '5px 0', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12 }}
              >
                Cancel
              </button>
            </div>
          ) : showTokenInput ? (
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700" style={{ padding: 12, borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 12, fontWeight: 600 }} className="text-gray-800 dark:text-gray-200">
                <Key style={{ width: 14, height: 14 }} /> Personal Access Token
              </div>
              <p className="text-gray-500 dark:text-gray-400" style={{ fontSize: 11, marginBottom: 8 }}>
                Enter a GitHub PAT with <code style={{ fontSize: 10 }}>repo</code> scope.
              </p>
              <input
                type="password"
                value={tokenValue}
                onChange={(e) => setTokenValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleTokenLogin(); }}
                className="minimal-input"
                placeholder="ghp_..."
                style={{ fontSize: 12, padding: '5px 8px', marginBottom: 8 }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleTokenLogin} disabled={loading || !tokenValue.trim()} className="minimal-button-primary disabled:opacity-50" style={{ flex: 1, fontSize: 12, padding: '5px 0' }}>
                  {loading ? <Spinner /> : 'Sign In'}
                </button>
                <button onClick={() => { setShowTokenInput(false); setTokenValue(''); }} className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200" style={{ padding: '5px 12px', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12 }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {browserAuthAvailable && (
                <button
                  onClick={handleGitHubBrowserLogin}
                  disabled={loading}
                  className="bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-gray-900 disabled:opacity-50"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '7px 0', borderRadius: 6, border: 'none', cursor: loading ? 'default' : 'pointer', fontSize: 12, fontWeight: 500 }}
                >
                  {loading ? <Spinner /> : <Github style={{ width: 14, height: 14 }} />}
                  {loading ? 'Opening browser...' : 'Sign in to GitHub'}
                </button>
              )}
              <button
                onClick={() => setShowTokenInput(true)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                style={{ width: '100%', padding: '5px 0', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 11, textDecoration: 'underline', textUnderlineOffset: 2 }}
              >
                {browserAuthAvailable ? 'Use personal access token instead' : 'Sign in with personal access token'}
              </button>
            </div>
          )}
        </div>

        {/* Push / Pull / Fetch */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {[
            { label: 'Pull', icon: <Download style={{ width: 13, height: 13 }} />, handler: handlePull, op: 'pull' },
            { label: 'Push', icon: <Upload style={{ width: 13, height: 13 }} />, handler: handlePush, op: 'push' },
            { label: 'Fetch', icon: <CloudDownload style={{ width: 13, height: 13 }} />, handler: handleFetch, op: 'fetch' },
          ].map(({ label, icon, handler, op }) => (
            <button
              key={label}
              onClick={handler}
              disabled={opLoading !== null || remotes.length === 0}
              className={remotes.length === 0
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
                : 'bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600'}
              title={remotes.length === 0 ? 'No remote configured' : label}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                padding: '6px 0', borderRadius: 6, border: remotes.length === 0 ? 'none' : undefined,
                cursor: (opLoading !== null || remotes.length === 0) ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 500,
              }}
            >
              {opLoading === op ? <Spinner size={13} /> : icon}
              {label}
            </button>
          ))}
        </div>

        {remotes.length === 0 && (
          <p className="text-gray-400 dark:text-gray-500" style={{ fontSize: 10, margin: '4px 0 0', textAlign: 'center' }}>
            No remote — publish to GitHub to enable sync
          </p>
        )}

        {/* Publish to GitHub */}
        {githubUser && remotes.length === 0 && (
          <button
            onClick={() => setShowPublishDialog(true)}
            className="bg-green-600 hover:bg-green-500 text-white"
            style={{ width: '100%', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
          >
            <Upload style={{ width: 13, height: 13 }} /> Publish to GitHub
          </button>
        )}

        {/* Invite People */}
        {githubUser && githubRemote && (
          <button
            onClick={async () => {
              setShowInviteDialog(!showInviteDialog);
              if (!showInviteDialog) await refreshCollaborators();
            }}
            className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            style={{ width: '100%', marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
          >
            <Users style={{ width: 13, height: 13 }} /> Invite People
          </button>
        )}

        {/* Invite Dialog */}
        {showInviteDialog && githubUser && githubRemote && (
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700" style={{ marginTop: 8, padding: 12, borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 className="text-gray-900 dark:text-white" style={{ fontSize: 12, fontWeight: 600, margin: 0 }}>Invite People</h3>
              <IconBtn onClick={() => setShowInviteDialog(false)} title="Close">
                <X style={{ width: 13, height: 13 }} />
              </IconBtn>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <label className="text-gray-500 dark:text-gray-400" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>GitHub Username</label>
                <input type="text" value={inviteUsername} onChange={(e) => setInviteUsername(e.target.value)} className="minimal-input" placeholder="octocat" style={{ fontSize: 12, padding: '5px 8px' }} />
              </div>
              <div>
                <label className="text-gray-500 dark:text-gray-400" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>Permission</label>
                <select value={invitePermission} onChange={(e) => setInvitePermission(e.target.value as CollaboratorPermission)} className="minimal-input" style={{ fontSize: 12, padding: '5px 8px' }}>
                  <option value="pull">Read</option>
                  <option value="triage">Triage</option>
                  <option value="push">Write</option>
                  <option value="maintain">Maintain</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button onClick={handleInviteCollaborator} disabled={loading || !inviteUsername.trim()} className="minimal-button-primary disabled:opacity-50" style={{ fontSize: 12, padding: '6px 0' }}>
                {loading ? <Spinner /> : 'Send Invite'}
              </button>
              {collaborators.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700" style={{ paddingTop: 8 }}>
                  <div className="text-gray-500 dark:text-gray-400" style={{ fontSize: 11, marginBottom: 6 }}>Collaborators</div>
                  <div style={{ maxHeight: 100, overflowY: 'auto' }} className="custom-scrollbar">
                    {collaborators.map((c) => (
                      <div key={c.login} className="text-gray-700 dark:text-gray-300" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 12 }}>
                        <img src={c.avatarUrl} style={{ width: 18, height: 18, borderRadius: '50%' }} alt={c.login} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.login}</span>
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
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700" style={{ marginTop: 8, padding: 12, borderRadius: 8 }}>
            <h3 className="text-gray-900 dark:text-white" style={{ fontSize: 12, fontWeight: 600, margin: '0 0 10px' }}>Publish to GitHub</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <label className="text-gray-500 dark:text-gray-400" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>Repository Name *</label>
                <input type="text" value={repoName} onChange={(e) => setRepoName(e.target.value)} className="minimal-input" placeholder="my-repository" style={{ fontSize: 12, padding: '5px 8px' }} />
              </div>
              <div>
                <label className="text-gray-500 dark:text-gray-400" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>Description</label>
                <input type="text" value={repoDescription} onChange={(e) => setRepoDescription(e.target.value)} className="minimal-input" placeholder="Repository description" style={{ fontSize: 12, padding: '5px 8px' }} />
              </div>
              <label className="text-gray-700 dark:text-gray-300" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={repoPrivate} onChange={(e) => setRepoPrivate(e.target.checked)} style={{ borderRadius: 3 }} />
                Private repository
              </label>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button onClick={handlePublishToGitHub} disabled={opLoading !== null || !repoName.trim()} className="bg-green-600 hover:bg-green-500 text-white disabled:opacity-50" style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: opLoading ? 'default' : 'pointer', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {opLoading === 'publish' ? <Spinner /> : null}
                  {opLoading === 'publish' ? 'Publishing...' : 'Publish'}
                </button>
                <button onClick={() => setShowPublishDialog(false)} className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200" style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12 }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Commit area ─────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 dark:border-gray-800" style={{ flexShrink: 0, padding: '12px 16px' }}>
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          onKeyDown={handleCommitKeyDown}
          className="minimal-input"
          placeholder="Message (Ctrl+Enter to commit & push)"
          rows={2}
          style={{ resize: 'none', minHeight: 50, fontSize: 12, marginBottom: 8 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleCommit}
            disabled={opLoading !== null || !commitMessage.trim() || stagedFiles.length === 0}
            className="minimal-button-primary w-full disabled:opacity-50"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, padding: '7px 0', flex: 1 }}
          >
            {opLoading === 'commit' ? <Spinner /> : <GitCommit style={{ width: 14, height: 14 }} />}
            Commit{stagedFiles.length > 0 ? ` (${stagedFiles.length})` : ''}
          </button>
          {files.filter(f => !f.staged).length > 0 && (
            <button
              onClick={handleStash}
              title="Stash all changes"
              className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              style={{ padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <Archive style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
      </div>

      {/* ─── File lists ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Staged Changes */}
        {stagedFiles.length > 0 && (
          <div className="border-b border-gray-200 dark:border-gray-800">
            <SectionHeader
              title="Staged Changes"
              count={stagedFiles.length}
              expanded={expandStaged}
              onToggle={() => setExpandStaged(!expandStaged)}
            />
            {expandStaged && (
              <div style={{ padding: '0 16px 8px' }}>
                {stagedFiles.map((file) => (
                  <div key={`staged-${file.path}`} className="hover:bg-gray-100 dark:hover:bg-gray-800 group" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 5 }}>
                    <StatusBadge status={file.status} />
                    <span className="text-gray-800 dark:text-gray-200" style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                          onClick={() => showDiff(file.path, true)}
                          title={`Click to view diff: ${file.path}`}>
                      {file.path}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100" style={{ display: 'flex', gap: 2, transition: 'opacity 150ms' }}>
                      <IconBtn onClick={(e) => { e.stopPropagation(); showDiff(file.path, true); }} title="View diff">
                        <Eye style={{ width: 13, height: 13 }} />
                      </IconBtn>
                      <IconBtn onClick={(e) => { e.stopPropagation(); handleUnstageFile(file); }} title="Unstage">
                        <Minus style={{ width: 13, height: 13 }} />
                      </IconBtn>
                    </div>
                  </div>
                ))}
                {diffFile && diffFile.staged && (
                  <InlineDiff diff={diffContent} onClose={() => setDiffFile(null)} />
                )}
              </div>
            )}
          </div>
        )}

        {/* Changes */}
        {unstagedFiles.length > 0 && (
          <div className="border-b border-gray-200 dark:border-gray-800">
            <SectionHeader
              title="Changes"
              count={unstagedFiles.length}
              expanded={expandChanges}
              onToggle={() => setExpandChanges(!expandChanges)}
              actions={
                <IconBtn onClick={(e) => { e.stopPropagation(); handleStageAll(); }} title="Stage all">
                  <Plus style={{ width: 13, height: 13 }} />
                </IconBtn>
              }
            />
            {expandChanges && (
              <div style={{ padding: '0 16px 8px' }}>
                {unstagedFiles.map((file) => (
                  <div key={`unstaged-${file.path}`} className="hover:bg-gray-100 dark:hover:bg-gray-800 group" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 5 }}>
                    <StatusBadge status={file.status} />
                    <span className="text-gray-800 dark:text-gray-200" style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                          onClick={() => showDiff(file.path, false)}
                          title={`Click to view diff: ${file.path}`}>
                      {file.path}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100" style={{ display: 'flex', gap: 2, transition: 'opacity 150ms' }}>
                      <IconBtn onClick={(e) => { e.stopPropagation(); showDiff(file.path, false); }} title="View diff">
                        <Eye style={{ width: 13, height: 13 }} />
                      </IconBtn>
                      <IconBtn onClick={(e) => { e.stopPropagation(); handleDiscardFile(file); }} title="Discard changes">
                        <Undo2 style={{ width: 13, height: 13 }} />
                      </IconBtn>
                      <IconBtn onClick={(e) => { e.stopPropagation(); handleStageFile(file); }} title="Stage">
                        <Plus style={{ width: 13, height: 13 }} />
                      </IconBtn>
                    </div>
                  </div>
                ))}
                {diffFile && !diffFile.staged && (
                  <InlineDiff diff={diffContent} onClose={() => setDiffFile(null)} />
                )}
              </div>
            )}
          </div>
        )}

        {/* No Changes */}
        {files.length === 0 && (
          <div className="text-gray-400 dark:text-gray-500" style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13 }}>
            No changes
          </div>
        )}

        {/* ─── Branches ──────────────────────────────────────────────── */}
        <div className="border-b border-gray-200 dark:border-gray-800">
          <SectionHeader
            title="Branches"
            count={branches.length}
            expanded={expandBranches}
            onToggle={() => { setExpandBranches(!expandBranches); if (!expandBranches) refreshBranches(); }}
          />
          {expandBranches && (
            <div style={{ padding: '0 16px 8px' }}>
              <div style={{ maxHeight: 180, overflowY: 'auto', marginBottom: 8 }} className="custom-scrollbar">
                {branches.map((branch) => (
                  <div key={branch.name} className="hover:bg-gray-100 dark:hover:bg-gray-800 group" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 5, fontSize: 12 }}>
                    {branch.current && <Check style={{ width: 12, height: 12, flexShrink: 0 }} className="text-green-500" />}
                    <span
                      onClick={() => !branch.current && handleCheckoutBranch(branch.name)}
                      className={branch.current ? 'text-gray-800 dark:text-gray-200' : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}
                      style={{ flex: 1, cursor: branch.current ? 'default' : 'pointer', fontWeight: branch.current ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: branch.current ? 0 : 18 }}
                    >
                      {branch.name}
                    </span>
                    {!branch.current && (
                      <div className="opacity-0 group-hover:opacity-100" style={{ display: 'flex', gap: 2, transition: 'opacity 150ms' }}>
                        <IconBtn onClick={(e) => { e.stopPropagation(); handleMergeBranch(branch.name); }} title={`Merge into ${currentBranch}`}>
                          <GitMerge style={{ width: 12, height: 12 }} />
                        </IconBtn>
                        <IconBtn onClick={(e) => { e.stopPropagation(); handleDeleteBranch(branch.name); }} title="Delete branch">
                          <Trash2 style={{ width: 12, height: 12 }} />
                        </IconBtn>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateBranch(); }}
                  className="minimal-input"
                  placeholder="New branch name"
                  style={{ flex: 1, fontSize: 12, padding: '5px 8px' }}
                />
                <button onClick={handleCreateBranch} disabled={!newBranchName.trim()} className="minimal-button-primary disabled:opacity-50" style={{ fontSize: 11, padding: '5px 10px' }}>
                  Create
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Stash ──────────────────────────────────────────────────── */}
        <div className="border-b border-gray-200 dark:border-gray-800">
          <SectionHeader
            title="Stashes"
            count={stashes.length}
            expanded={expandStash}
            onToggle={() => { setExpandStash(!expandStash); if (!expandStash) refreshStashes(); }}
          />
          {expandStash && (
            <div style={{ padding: '0 16px 8px' }}>
              {stashes.length === 0 ? (
                <p className="text-gray-400 dark:text-gray-500" style={{ fontSize: 11, padding: '4px 6px' }}>No stashes</p>
              ) : (
                stashes.map((stash) => (
                  <div key={stash.index} className="hover:bg-gray-100 dark:hover:bg-gray-800 group" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 5, fontSize: 12 }}>
                    <Archive style={{ width: 12, height: 12, flexShrink: 0 }} className="text-gray-400" />
                    <span className="text-gray-700 dark:text-gray-300" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {stash.message}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100" style={{ display: 'flex', gap: 2, transition: 'opacity 150ms' }}>
                      <IconBtn onClick={() => handleStashPop(stash.index)} title="Apply & remove">
                        <Check style={{ width: 12, height: 12 }} />
                      </IconBtn>
                      <IconBtn onClick={() => handleStashDrop(stash.index)} title="Drop">
                        <Trash2 style={{ width: 12, height: 12 }} />
                      </IconBtn>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ─── Commit History ─────────────────────────────────────────── */}
        <div>
          <SectionHeader
            title="History"
            count={commits.length}
            expanded={expandHistory}
            onToggle={() => { setExpandHistory(!expandHistory); if (!expandHistory) refreshHistory(); }}
          />
          {expandHistory && (
            <div style={{ padding: '0 16px 8px' }}>
              {commits.length === 0 ? (
                <p className="text-gray-400 dark:text-gray-500" style={{ fontSize: 11, padding: '4px 6px' }}>No commits yet</p>
              ) : (
                <div style={{ maxHeight: 300, overflowY: 'auto' }} className="custom-scrollbar">
                  {commits.map((commit) => (
                    <div key={commit.hash} className="hover:bg-gray-100 dark:hover:bg-gray-800" style={{ padding: '6px 6px', borderRadius: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <GitCommit style={{ width: 12, height: 12, flexShrink: 0 }} className="text-gray-400" />
                        <span className="text-gray-800 dark:text-gray-200" style={{ fontSize: 12, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {commit.message}
                        </span>
                      </div>
                      <div className="text-gray-400 dark:text-gray-500" style={{ fontSize: 10, marginLeft: 18, marginTop: 2 }}>
                        <span style={{ fontFamily: 'ui-monospace, monospace' }}>{commit.hash.substring(0, 7)}</span>
                        {' · '}
                        {commit.author}
                        {' · '}
                        {new Date(commit.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── CSS Keyframes ────────────────────────────────────────────── */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};
