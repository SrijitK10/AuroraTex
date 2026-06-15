import simpleGit, { SimpleGit, StatusResult, BranchSummary, LogResult } from 'simple-git';
import GitHubService from './GitHubService';

// ─── Public Interfaces ──────────────────────────────────────────────────────

export interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted';
  staged: boolean;
}

export interface GitCommitInfo {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export interface GitBranchInfo {
  name: string;
  current: boolean;
  commit: string;
}

export interface GitRemoteInfo {
  name: string;
  url: string;
}

// ─── Error helper ────────────────────────────────────────────────────────────

function toSerializableError(err: unknown): Error {
  if (err instanceof Error) {
    // simple-git wraps errors with .message containing the git stderr output
    return new Error(err.message);
  }
  return new Error(String(err));
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class GitService {
  private git: SimpleGit | null = null;
  private repoPath: string | null = null;

  // ─── Auth remote helper ──────────────────────────────────────────────────

  /**
   * Get remote URL with GitHub authentication token injected if available.
   */
  private async getAuthRemote(remoteName: string): Promise<string | null> {
    if (!this.git) return null;

    try {
      const remotes = await this.git.getRemotes(true);
      const remote = remotes.find((r) => r.name === remoteName);
      if (!remote) return null;

      let url = remote.refs.push || remote.refs.fetch || '';

      if (url.includes('github.com')) {
        // Ensure GitHubService credentials are loaded
        await GitHubService.isAuthenticated();
        const creds = GitHubService.getCredentials();
        if (creds && creds.token) {
          // git@github.com:owner/repo.git → https://...
          if (url.startsWith('git@github.com:')) {
            const path = url.substring('git@github.com:'.length);
            return `https://x-access-token:${creds.token}@github.com/${path}`;
          }
          // https://github.com/... (no token yet)
          if (url.startsWith('https://') && !url.includes('@github.com')) {
            return url.replace(
              'https://github.com/',
              `https://x-access-token:${creds.token}@github.com/`
            );
          }
          // https://existing-token@github.com/... → replace
          if (url.startsWith('https://') && url.includes('@github.com')) {
            return url.replace(
              /https:\/\/[^@]+@github\.com\//,
              `https://x-access-token:${creds.token}@github.com/`
            );
          }
        }
      }
    } catch (e) {
      console.error('[GitService] Failed to parse auth remote:', e);
    }
    return null;
  }

  /**
   * Inject GitHub token into a URL for clone/remote operations on private repos.
   */
  private async getAuthUrl(url: string): Promise<string> {
    if (!url.includes('github.com')) return url;

    try {
      await GitHubService.isAuthenticated();
      const creds = GitHubService.getCredentials();
      if (creds && creds.token) {
        if (url.startsWith('git@github.com:')) {
          const path = url.substring('git@github.com:'.length);
          return `https://x-access-token:${creds.token}@github.com/${path}`;
        }
        if (url.startsWith('https://github.com/')) {
          return url.replace(
            'https://github.com/',
            `https://x-access-token:${creds.token}@github.com/`
          );
        }
      }
    } catch {
      // Proceed without auth
    }
    return url;
  }

  // ─── Repository initialization ───────────────────────────────────────────

  async initialize(projectPath: string): Promise<boolean> {
    try {
      this.repoPath = projectPath;
      this.git = simpleGit(projectPath);

      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        console.log('[GitService] Not a git repository:', projectPath);
        this.git = null;
        this.repoPath = null;
        return false;
      }

      console.log('[GitService] Initialized for repository:', projectPath);
      return true;
    } catch (error) {
      console.error('[GitService] Initialization failed:', error);
      this.git = null;
      this.repoPath = null;
      return false;
    }
  }

  async initRepository(projectPath: string): Promise<void> {
    try {
      const git = simpleGit(projectPath);
      await git.init();
      this.repoPath = projectPath;
      this.git = git;
      console.log('[GitService] Repository initialized:', projectPath);
    } catch (error) {
      console.error('[GitService] Failed to init repository:', error);
      throw toSerializableError(error);
    }
  }

  // ─── Status ──────────────────────────────────────────────────────────────

  async getStatus(): Promise<GitFileStatus[]> {
    if (!this.git) throw new Error('Git not initialized. Open a project first.');

    try {
      const status: StatusResult = await this.git.status();
      const files: GitFileStatus[] = [];

      // Staged files
      status.staged.forEach((path) => {
        files.push({ path, status: 'modified', staged: true });
      });

      status.created.forEach((path) => {
        files.push({ path, status: 'added', staged: true });
      });

      status.deleted.forEach((path) => {
        files.push({ path, status: 'deleted', staged: true });
      });

      status.renamed.forEach((file) => {
        files.push({ path: file.to, status: 'renamed', staged: true });
      });

      // Unstaged/working-tree modifications
      status.modified.forEach((path) => {
        files.push({ path, status: 'modified', staged: false });
      });

      status.not_added.forEach((path) => {
        files.push({ path, status: 'untracked', staged: false });
      });

      // Conflicted files
      status.conflicted.forEach((path) => {
        files.push({ path, status: 'conflicted', staged: false });
      });

      return files;
    } catch (error) {
      console.error('[GitService] Failed to get status:', error);
      throw toSerializableError(error);
    }
  }

  // ─── Staging ─────────────────────────────────────────────────────────────

  async stageFiles(files: string[]): Promise<void> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      await this.git.add(files);
      console.log('[GitService] Staged files:', files);
    } catch (error) {
      console.error('[GitService] Failed to stage files:', error);
      throw toSerializableError(error);
    }
  }

  async unstageFiles(files: string[]): Promise<void> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      await this.git.reset(['HEAD', '--', ...files]);
      console.log('[GitService] Unstaged files:', files);
    } catch (error) {
      console.error('[GitService] Failed to unstage files:', error);
      throw toSerializableError(error);
    }
  }

  async stageAll(): Promise<void> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      await this.git.add(['-A']);
      console.log('[GitService] Staged all changes');
    } catch (error) {
      console.error('[GitService] Failed to stage all:', error);
      throw toSerializableError(error);
    }
  }

  // ─── Commit ──────────────────────────────────────────────────────────────

  async commit(message: string): Promise<string> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      // Ensure user info is configured
      try {
        const name = await this.git.getConfig('user.name');
        const email = await this.git.getConfig('user.email');
        if (!name.value || !email.value) {
          const user = await GitHubService.getCurrentUser();
          if (user) {
            if (!name.value)
              await this.git.addConfig('user.name', user.name || user.login);
            if (!email.value)
              await this.git.addConfig(
                'user.email',
                user.email || `${user.login}@users.noreply.github.com`
              );
          } else {
            if (!name.value) await this.git.addConfig('user.name', 'AuroraTex User');
            if (!email.value) await this.git.addConfig('user.email', 'user@auroratex.local');
          }
        }
      } catch {
        // Non-fatal — commit may still work with global git config
      }

      const result = await this.git.commit(message);
      console.log('[GitService] Committed:', result.commit);
      return result.commit;
    } catch (error) {
      console.error('[GitService] Failed to commit:', error);
      throw toSerializableError(error);
    }
  }

  // ─── Log ─────────────────────────────────────────────────────────────────

  async getLog(maxCount: number = 50): Promise<GitCommitInfo[]> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      const log: LogResult = await this.git.log({ maxCount });
      return log.all.map((commit) => ({
        hash: commit.hash,
        author: commit.author_name,
        date: commit.date,
        message: commit.message,
      }));
    } catch (error) {
      console.error('[GitService] Failed to get log:', error);
      throw toSerializableError(error);
    }
  }

  // ─── Branches ────────────────────────────────────────────────────────────

  async getBranches(): Promise<GitBranchInfo[]> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      const summary: BranchSummary = await this.git.branch();
      return Object.keys(summary.branches).map((name) => ({
        name,
        current: name === summary.current,
        commit: summary.branches[name].commit,
      }));
    } catch (error) {
      console.error('[GitService] Failed to get branches:', error);
      throw toSerializableError(error);
    }
  }

  async createBranch(branchName: string, checkout: boolean = false): Promise<void> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      if (checkout) {
        await this.git.checkoutLocalBranch(branchName);
      } else {
        await this.git.branch([branchName]);
      }
      console.log('[GitService] Created branch:', branchName);
    } catch (error) {
      console.error('[GitService] Failed to create branch:', error);
      throw toSerializableError(error);
    }
  }

  async checkoutBranch(branchName: string, autoStash: boolean = true): Promise<void> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      let didStash = false;

      if (autoStash) {
        const status = await this.git.status();
        if (status.files.length > 0) {
          await this.git.stash(['push', '-m', `Auto-stash before checkout to ${branchName}`]);
          didStash = true;
          console.log('[GitService] Stashed changes before checkout');
        }
      }

      await this.git.checkout(branchName);
      console.log('[GitService] Checked out branch:', branchName);

      // Restore stash if we created one
      if (didStash) {
        try {
          await this.git.stash(['pop']);
          console.log('[GitService] Restored stashed changes');
        } catch (stashError) {
          console.warn('[GitService] Could not restore stash (may have conflicts):', stashError);
        }
      }
    } catch (error) {
      console.error('[GitService] Failed to checkout branch:', error);
      throw toSerializableError(error);
    }
  }

  async deleteBranch(branchName: string, force: boolean = false): Promise<void> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      await this.git.deleteLocalBranch(branchName, force);
      console.log('[GitService] Deleted branch:', branchName);
    } catch (error) {
      console.error('[GitService] Failed to delete branch:', error);
      throw toSerializableError(error);
    }
  }

  async renameBranch(oldName: string, newName: string): Promise<void> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      await this.git.branch(['-m', oldName, newName]);
      console.log('[GitService] Renamed branch:', oldName, '→', newName);
    } catch (error) {
      console.error('[GitService] Failed to rename branch:', error);
      throw toSerializableError(error);
    }
  }

  async mergeBranch(branchName: string): Promise<string> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      const result = await this.git.merge([branchName]);
      console.log('[GitService] Merged branch:', branchName);
      return result.result || 'Merge successful';
    } catch (error: any) {
      // Merge conflicts produce a special error
      if (error?.git?.conflicts && error.git.conflicts.length > 0) {
        throw new Error(
          `Merge conflict in ${error.git.conflicts.length} file(s): ${error.git.conflicts.join(', ')}. Please resolve conflicts and commit.`
        );
      }
      console.error('[GitService] Failed to merge branch:', error);
      throw toSerializableError(error);
    }
  }

  // ─── Remote operations ───────────────────────────────────────────────────

  async push(
    remote: string = 'origin',
    branch?: string,
    setUpstream: boolean = false
  ): Promise<void> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      const authUrl = await this.getAuthRemote(remote);
      const target = authUrl || remote;

      // Use git.raw() for reliable argument handling — simple-git's .push()
      // has a confusing overloaded signature that misinterprets arrays.
      const args = ['push'];
      if (setUpstream) args.push('-u');
      args.push(target);
      if (branch) args.push(branch);

      await this.git.raw(args);
      console.log('[GitService] Pushed to remote:', remote);
    } catch (error) {
      console.error('[GitService] Failed to push:', error);
      throw toSerializableError(error);
    }
  }

  async pull(remote: string = 'origin', branch?: string): Promise<void> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      const authUrl = await this.getAuthRemote(remote);
      const target = authUrl || remote;

      if (branch) {
        await this.git.pull(target, branch);
      } else {
        await this.git.pull(target);
      }
      console.log('[GitService] Pulled from remote:', remote);
    } catch (error) {
      console.error('[GitService] Failed to pull:', error);
      throw toSerializableError(error);
    }
  }

  async fetch(remote: string = 'origin'): Promise<void> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      const authUrl = await this.getAuthRemote(remote);
      const target = authUrl || remote;

      await this.git.fetch(target);
      console.log('[GitService] Fetched from remote:', remote);
    } catch (error) {
      console.error('[GitService] Failed to fetch:', error);
      throw toSerializableError(error);
    }
  }

  // ─── Remotes ─────────────────────────────────────────────────────────────

  async getRemotes(): Promise<GitRemoteInfo[]> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      const remotes = await this.git.getRemotes(true);
      return remotes.map((remote) => ({
        name: remote.name,
        url: remote.refs.fetch || remote.refs.push || '',
      }));
    } catch (error) {
      console.error('[GitService] Failed to get remotes:', error);
      throw toSerializableError(error);
    }
  }

  async addRemote(name: string, url: string): Promise<void> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      const remotes = await this.git.getRemotes();
      if (remotes.find((r) => r.name === name)) {
        await this.git.removeRemote(name);
      }
      await this.git.addRemote(name, url);
      console.log('[GitService] Added remote:', name, url);
    } catch (error) {
      console.error('[GitService] Failed to add remote:', error);
      throw toSerializableError(error);
    }
  }

  async removeRemote(name: string): Promise<void> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      await this.git.removeRemote(name);
      console.log('[GitService] Removed remote:', name);
    } catch (error) {
      console.error('[GitService] Failed to remove remote:', error);
      throw toSerializableError(error);
    }
  }

  // ─── Diff ────────────────────────────────────────────────────────────────

  async getDiff(filePath?: string): Promise<string> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      if (filePath) {
        return await this.git.diff(['--', filePath]);
      }
      return await this.git.diff();
    } catch (error) {
      console.error('[GitService] Failed to get diff:', error);
      throw toSerializableError(error);
    }
  }

  async getStagedDiff(filePath?: string): Promise<string> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      if (filePath) {
        return await this.git.diff(['--cached', '--', filePath]);
      }
      return await this.git.diff(['--cached']);
    } catch (error) {
      console.error('[GitService] Failed to get staged diff:', error);
      throw toSerializableError(error);
    }
  }

  /**
   * Get diff for a specific file, either staged or unstaged.
   */
  async getFileDiff(filePath: string, staged: boolean = false): Promise<string> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      const args = staged
        ? ['--cached', '--', filePath]
        : ['--', filePath];
      return await this.git.diff(args);
    } catch (error) {
      console.error('[GitService] Failed to get file diff:', error);
      throw toSerializableError(error);
    }
  }

  // ─── Discard ─────────────────────────────────────────────────────────────

  async discardChanges(files: string[]): Promise<void> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      // Separate untracked files from tracked files
      const status = await this.git.status();
      const untrackedSet = new Set(status.not_added);

      const trackedFiles = files.filter((f) => !untrackedSet.has(f));
      const untrackedFiles = files.filter((f) => untrackedSet.has(f));

      // Restore tracked files
      if (trackedFiles.length > 0) {
        await this.git.checkout(['--', ...trackedFiles]);
      }

      // Remove untracked files
      if (untrackedFiles.length > 0) {
        await this.git.clean('f', untrackedFiles);
      }

      console.log('[GitService] Discarded changes in:', files);
    } catch (error) {
      console.error('[GitService] Failed to discard changes:', error);
      throw toSerializableError(error);
    }
  }

  // ─── Clone ───────────────────────────────────────────────────────────────

  async clone(url: string, targetPath: string): Promise<void> {
    try {
      const authUrl = await this.getAuthUrl(url);
      const git = simpleGit();
      await git.clone(authUrl, targetPath);
      console.log('[GitService] Cloned repository:', url, 'to', targetPath);

      // Initialize for the new repo
      await this.initialize(targetPath);
    } catch (error) {
      console.error('[GitService] Failed to clone:', error);
      throw toSerializableError(error);
    }
  }

  // ─── Branch info ─────────────────────────────────────────────────────────

  async getCurrentBranch(): Promise<string> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      const summary = await this.git.branch();
      return summary.current;
    } catch (error) {
      console.error('[GitService] Failed to get current branch:', error);
      throw toSerializableError(error);
    }
  }

  async isClean(): Promise<boolean> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      const status = await this.git.status();
      return status.isClean();
    } catch (error) {
      console.error('[GitService] Failed to check if clean:', error);
      throw toSerializableError(error);
    }
  }

  // ─── Stash ───────────────────────────────────────────────────────────────

  async stash(message?: string): Promise<void> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      const args = message ? ['push', '-m', message] : ['push'];
      await this.git.stash(args);
      console.log('[GitService] Stashed changes:', message || '(no message)');
    } catch (error) {
      console.error('[GitService] Failed to stash:', error);
      throw toSerializableError(error);
    }
  }

  async stashPop(index?: number): Promise<void> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      const args = index !== undefined ? ['pop', `stash@{${index}}`] : ['pop'];
      await this.git.stash(args);
      console.log('[GitService] Popped stash');
    } catch (error) {
      console.error('[GitService] Failed to pop stash:', error);
      throw toSerializableError(error);
    }
  }

  async stashDrop(index?: number): Promise<void> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      const args = index !== undefined ? ['drop', `stash@{${index}}`] : ['drop'];
      await this.git.stash(args);
      console.log('[GitService] Dropped stash');
    } catch (error) {
      console.error('[GitService] Failed to drop stash:', error);
      throw toSerializableError(error);
    }
  }

  async stashList(): Promise<Array<{ index: number; message: string }>> {
    if (!this.git) throw new Error('Git not initialized.');

    try {
      const result = await this.git.stashList();
      return result.all.map((entry: any, i: number) => ({
        index: i,
        message: entry.message || `stash@{${i}}`,
      }));
    } catch (error) {
      console.error('[GitService] Failed to list stashes:', error);
      throw toSerializableError(error);
    }
  }
}

export default new GitService();
