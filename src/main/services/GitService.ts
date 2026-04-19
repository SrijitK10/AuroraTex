import simpleGit, { SimpleGit, StatusResult, BranchSummary, LogResult, DiffResult } from 'simple-git';
import { existsSync } from 'fs';
import { join } from 'path';

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

export class GitService {
  private git: SimpleGit | null = null;
  private repoPath: string | null = null;

  /**
   * Initialize Git for a project directory
   */
  async initialize(projectPath: string): Promise<boolean> {
    try {
      this.repoPath = projectPath;
      this.git = simpleGit(projectPath);
      
      // Check if it's a git repository
      const isRepo = await this.git.checkIsRepo();
      
      if (!isRepo) {
        console.log('[GitService] Not a git repository:', projectPath);
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

  /**
   * Initialize a new Git repository
   */
  async initRepository(projectPath: string): Promise<void> {
    try {
      const git = simpleGit(projectPath);
      await git.init();
      this.repoPath = projectPath;
      this.git = git;
      console.log('[GitService] Repository initialized:', projectPath);
    } catch (error) {
      console.error('[GitService] Failed to init repository:', error);
      throw error;
    }
  }

  /**
   * Get current repository status
   */
  async getStatus(): Promise<GitFileStatus[]> {
    if (!this.git) {
      throw new Error('Git not initialized');
    }

    try {
      const status: StatusResult = await this.git.status();
      const files: GitFileStatus[] = [];

      // Staged files
      status.staged.forEach(path => {
        files.push({ path, status: 'modified', staged: true });
      });

      status.created.forEach(path => {
        files.push({ path, status: 'added', staged: true });
      });

      status.deleted.forEach(path => {
        files.push({ path, status: 'deleted', staged: true });
      });

      status.renamed.forEach(file => {
        files.push({ path: file.to, status: 'renamed', staged: true });
      });

      // Unstaged files
      status.modified.forEach(path => {
        if (!files.find(f => f.path === path)) {
          files.push({ path, status: 'modified', staged: false });
        }
      });

      status.not_added.forEach(path => {
        files.push({ path, status: 'untracked', staged: false });
      });

      // Conflicted files
      status.conflicted.forEach(path => {
        files.push({ path, status: 'conflicted', staged: false });
      });

      return files;
    } catch (error) {
      console.error('[GitService] Failed to get status:', error);
      throw error;
    }
  }

  /**
   * Stage files
   */
  async stageFiles(files: string[]): Promise<void> {
    if (!this.git) {
      throw new Error('Git not initialized');
    }

    try {
      await this.git.add(files);
      console.log('[GitService] Staged files:', files);
    } catch (error) {
      console.error('[GitService] Failed to stage files:', error);
      throw error;
    }
  }

  /**
   * Unstage files
   */
  async unstageFiles(files: string[]): Promise<void> {
    if (!this.git) {
      throw new Error('Git not initialized');
    }

    try {
      await this.git.reset(['HEAD', '--', ...files]);
      console.log('[GitService] Unstaged files:', files);
    } catch (error) {
      console.error('[GitService] Failed to unstage files:', error);
      throw error;
    }
  }

  /**
   * Commit staged changes
   */
  async commit(message: string): Promise<string> {
    if (!this.git) {
      throw new Error('Git not initialized');
    }

    try {
      const result = await this.git.commit(message);
      console.log('[GitService] Committed:', result.commit);
      return result.commit;
    } catch (error) {
      console.error('[GitService] Failed to commit:', error);
      throw error;
    }
  }

  /**
   * Get commit history
   */
  async getLog(maxCount: number = 50): Promise<GitCommitInfo[]> {
    if (!this.git) {
      throw new Error('Git not initialized');
    }

    try {
      const log: LogResult = await this.git.log({ maxCount });
      return log.all.map(commit => ({
        hash: commit.hash,
        author: commit.author_name,
        date: commit.date,
        message: commit.message
      }));
    } catch (error) {
      console.error('[GitService] Failed to get log:', error);
      throw error;
    }
  }

  /**
   * Get branches
   */
  async getBranches(): Promise<GitBranchInfo[]> {
    if (!this.git) {
      throw new Error('Git not initialized');
    }

    try {
      const summary: BranchSummary = await this.git.branch();
      return Object.keys(summary.branches).map(name => ({
        name,
        current: name === summary.current,
        commit: summary.branches[name].commit
      }));
    } catch (error) {
      console.error('[GitService] Failed to get branches:', error);
      throw error;
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(branchName: string, checkout: boolean = false): Promise<void> {
    if (!this.git) {
      throw new Error('Git not initialized');
    }

    try {
      if (checkout) {
        await this.git.checkoutLocalBranch(branchName);
      } else {
        await this.git.branch([branchName]);
      }
      console.log('[GitService] Created branch:', branchName);
    } catch (error) {
      console.error('[GitService] Failed to create branch:', error);
      throw error;
    }
  }

  /**
   * Checkout a branch
   */
  async checkoutBranch(branchName: string, autoStash: boolean = true): Promise<void> {
    if (!this.git) {
      throw new Error('Git not initialized');
    }

    try {
      // Check if there are uncommitted changes
      if (autoStash) {
        const status = await this.git.status();
        const hasChanges = status.files.length > 0;
        
        if (hasChanges) {
          // Stash changes before checkout
          await this.git.stash(['push', '-m', `Auto-stash before checkout to ${branchName}`]);
          console.log('[GitService] Stashed changes before checkout');
        }
      }
      
      await this.git.checkout(branchName);
      console.log('[GitService] Checked out branch:', branchName);
      
      // Try to pop the stash if we created one
      if (autoStash) {
        try {
          const stashList = await this.git.stashList();
          if (stashList.total > 0 && stashList.latest?.message.includes(`Auto-stash before checkout to ${branchName}`)) {
            await this.git.stash(['pop']);
            console.log('[GitService] Restored stashed changes');
          }
        } catch (stashError) {
          console.warn('[GitService] Could not restore stash (may have conflicts):', stashError);
        }
      }
    } catch (error) {
      console.error('[GitService] Failed to checkout branch:', error);
      throw error;
    }
  }

  /**
   * Delete a branch
   */
  async deleteBranch(branchName: string, force: boolean = false): Promise<void> {
    if (!this.git) {
      throw new Error('Git not initialized');
    }

    try {
      await this.git.deleteLocalBranch(branchName, force);
      console.log('[GitService] Deleted branch:', branchName);
    } catch (error) {
      console.error('[GitService] Failed to delete branch:', error);
      throw error;
    }
  }

  /**
   * Push to remote
   */
  async push(remote: string = 'origin', branch?: string, setUpstream: boolean = false): Promise<void> {
    if (!this.git) {
      throw new Error('Git not initialized');
    }

    try {
      if (branch) {
        const options = setUpstream ? ['--set-upstream', remote, branch] : [remote, branch];
        await this.git.push(options);
      } else {
        await this.git.push();
      }
      console.log('[GitService] Pushed to remote:', remote);
    } catch (error) {
      console.error('[GitService] Failed to push:', error);
      throw error;
    }
  }

  /**
   * Pull from remote
   */
  async pull(remote: string = 'origin', branch?: string): Promise<void> {
    if (!this.git) {
      throw new Error('Git not initialized');
    }

    try {
      if (branch) {
        await this.git.pull(remote, branch);
      } else {
        await this.git.pull();
      }
      console.log('[GitService] Pulled from remote:', remote);
    } catch (error) {
      console.error('[GitService] Failed to pull:', error);
      throw error;
    }
  }

  /**
   * Fetch from remote
   */
  async fetch(remote: string = 'origin'): Promise<void> {
    if (!this.git) {
      throw new Error('Git not initialized');
    }

    try {
      await this.git.fetch(remote);
      console.log('[GitService] Fetched from remote:', remote);
    } catch (error) {
      console.error('[GitService] Failed to fetch:', error);
      throw error;
    }
  }

  /**
   * Get remotes
   */
  async getRemotes(): Promise<GitRemoteInfo[]> {
    if (!this.git) {
      throw new Error('Git not initialized');
    }

    try {
      const remotes = await this.git.getRemotes(true);
      return remotes.map(remote => ({
        name: remote.name,
        url: remote.refs.fetch || remote.refs.push || ''
      }));
    } catch (error) {
      console.error('[GitService] Failed to get remotes:', error);
      throw error;
    }
  }

  /**
   * Add a remote
   */
  async addRemote(name: string, url: string): Promise<void> {
    if (!this.git) {
      throw new Error('Git not initialized');
    }

    try {
      await this.git.addRemote(name, url);
      console.log('[GitService] Added remote:', name, url);
    } catch (error) {
      console.error('[GitService] Failed to add remote:', error);
      throw error;
    }
  }

  /**
   * Remove a remote
   */
  async removeRemote(name: string): Promise<void> {
    if (!this.git) {
      throw new Error('Git not initialized');
    }

    try {
      await this.git.removeRemote(name);
      console.log('[GitService] Removed remote:', name);
    } catch (error) {
      console.error('[GitService] Failed to remove remote:', error);
      throw error;
    }
  }

  /**
   * Get file diff
   */
  async getDiff(filePath?: string): Promise<string> {
    if (!this.git) {
      throw new Error('Git not initialized');
    }

    try {
      if (filePath) {
        return await this.git.diff(['--', filePath]);
      } else {
        return await this.git.diff();
      }
    } catch (error) {
      console.error('[GitService] Failed to get diff:', error);
      throw error;
    }
  }

  /**
   * Discard changes in file
   */
  async discardChanges(files: string[]): Promise<void> {
    if (!this.git) {
      throw new Error('Git not initialized');
    }

    try {
      await this.git.checkout(['--', ...files]);
      console.log('[GitService] Discarded changes in:', files);
    } catch (error) {
      console.error('[GitService] Failed to discard changes:', error);
      throw error;
    }
  }

  /**
   * Clone a repository
   */
  async clone(url: string, targetPath: string): Promise<void> {
    try {
      const git = simpleGit();
      await git.clone(url, targetPath);
      console.log('[GitService] Cloned repository:', url, 'to', targetPath);
      
      // Initialize for the new repo
      await this.initialize(targetPath);
    } catch (error) {
      console.error('[GitService] Failed to clone:', error);
      throw error;
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    if (!this.git) {
      throw new Error('Git not initialized');
    }

    try {
      const summary = await this.git.branch();
      return summary.current;
    } catch (error) {
      console.error('[GitService] Failed to get current branch:', error);
      throw error;
    }
  }

  /**
   * Check if repository is clean (no changes)
   */
  async isClean(): Promise<boolean> {
    if (!this.git) {
      throw new Error('Git not initialized');
    }

    try {
      const status = await this.git.status();
      return status.isClean();
    } catch (error) {
      console.error('[GitService] Failed to check if clean:', error);
      throw error;
    }
  }

  /**
   * Stash changes
   */
  async stash(message?: string): Promise<void> {
    if (!this.git) {
      throw new Error('Git not initialized');
    }

    try {
      const args = message ? ['push', '-m', message] : ['push'];
      await this.git.stash(args);
      console.log('[GitService] Stashed changes:', message || '(no message)');
    } catch (error) {
      console.error('[GitService] Failed to stash:', error);
      throw error;
    }
  }

  /**
   * Pop stashed changes
   */
  async stashPop(): Promise<void> {
    if (!this.git) {
      throw new Error('Git not initialized');
    }

    try {
      await this.git.stash(['pop']);
      console.log('[GitService] Popped stash');
    } catch (error) {
      console.error('[GitService] Failed to pop stash:', error);
      throw error;
    }
  }

  /**
   * List stashed changes
   */
  async stashList(): Promise<any[]> {
    if (!this.git) {
      throw new Error('Git not initialized');
    }

    try {
      const result = await this.git.stashList();
      return [...result.all];
    } catch (error) {
      console.error('[GitService] Failed to list stashes:', error);
      throw error;
    }
  }
}

export default new GitService();
