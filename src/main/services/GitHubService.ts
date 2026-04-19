import { app, shell } from 'electron';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface GitHubUser {
  login: string;
  name: string;
  email: string;
  avatarUrl: string;
}

export interface GitHubRepository {
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  url: string;
  cloneUrl: string;
  defaultBranch: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: string;
  author: string;
  createdAt: string;
  url: string;
}

export interface GitHubCredentials {
  token: string;
  username: string;
  authMethod?: 'browser' | 'token';
  scopes?: string[];
}

export interface GitHubBrowserAuthSession {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresAt: string;
  interval: number;
}

export interface GitHubCollaboratorInvite {
  username: string;
  permission: string;
  status: 'already_collaborator' | 'invited';
  invitationUrl?: string;
}

export interface GitHubCollaborator {
  login: string;
  avatarUrl: string;
  permissions: {
    pull?: boolean;
    triage?: boolean;
    push?: boolean;
    maintain?: boolean;
    admin?: boolean;
  };
}

export class GitHubService {
  private octokit: any = null;
  private credentials: GitHubCredentials | null = null;
  private credentialsFile: string;
  private Octokit: any = null;
  private readonly browserAuthScope = 'repo read:user user:email';

  constructor() {
    this.credentialsFile = join(app.getPath('userData'), '.github-credentials.json');
    this.loadCredentials();
  }

  /**
   * Get Octokit class (lazy load)
   */
  private async getOctokit(): Promise<any> {
    if (!this.Octokit) {
      const module = await eval('import("@octokit/rest")');
      this.Octokit = module.Octokit;
    }
    return this.Octokit;
  }

  /**
   * Load saved credentials
   */
  private async loadCredentials(): Promise<void> {
    try {
      if (existsSync(this.credentialsFile)) {
        const data = readFileSync(this.credentialsFile, 'utf-8');
        this.credentials = JSON.parse(data);
        
        if (this.credentials?.token) {
          const OctokitClass = await this.getOctokit();
          this.octokit = new OctokitClass({
            auth: this.credentials!.token
          });
          console.log('[GitHubService] Loaded credentials for:', this.credentials!.username);
        }
      }
    } catch (error) {
      console.error('[GitHubService] Failed to load credentials:', error);
      this.credentials = null;
      this.octokit = null;
    }
  }

  /**
   * Save credentials
   */
  private saveCredentials(): void {
    try {
      if (this.credentials) {
        writeFileSync(this.credentialsFile, JSON.stringify(this.credentials, null, 2));
        console.log('[GitHubService] Saved credentials');
      }
    } catch (error) {
      console.error('[GitHubService] Failed to save credentials:', error);
    }
  }

  /**
   * Get the public OAuth client id used by GitHub's browser/device flow.
   */
  private getOAuthClientId(): string {
    const clientId =
      process.env.GITHUB_OAUTH_CLIENT_ID ||
      process.env.GITHUB_CLIENT_ID ||
      process.env.VITE_GITHUB_CLIENT_ID ||
      '';

    if (!clientId.trim()) {
      throw new Error(
        'GitHub browser sign-in is not configured. Set GITHUB_CLIENT_ID to your GitHub OAuth app client ID.'
      );
    }

    return clientId.trim();
  }

  /**
   * POST form data to a GitHub OAuth endpoint and return the JSON payload.
   */
  private async postGitHubOAuth(url: string, params: Record<string, string>): Promise<any> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(params).toString()
    });

    const data = await response.json() as any;

    if (!response.ok && !data.error) {
      throw new Error(data.error_description || data.message || `GitHub OAuth request failed (${response.status})`);
    }

    return data;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Start GitHub browser/device authorization and open GitHub in the user's browser.
   */
  async startBrowserAuth(): Promise<GitHubBrowserAuthSession> {
    try {
      const clientId = this.getOAuthClientId();
      const data = await this.postGitHubOAuth('https://github.com/login/device/code', {
        client_id: clientId,
        scope: this.browserAuthScope
      });

      if (data.error) {
        throw new Error(data.error_description || data.error);
      }

      if (!data.device_code || !data.user_code || !data.verification_uri) {
        throw new Error('GitHub did not return a browser sign-in code.');
      }

      await shell.openExternal(data.verification_uri);

      return {
        deviceCode: data.device_code,
        userCode: data.user_code,
        verificationUri: data.verification_uri,
        expiresAt: new Date(Date.now() + Number(data.expires_in || 900) * 1000).toISOString(),
        interval: Number(data.interval || 5)
      };
    } catch (error) {
      console.error('[GitHubService] Failed to start browser auth:', error);
      throw error;
    }
  }

  /**
   * Poll GitHub until the browser/device authorization has completed.
   */
  async completeBrowserAuth(deviceCode: string, interval: number = 5, expiresAt?: string): Promise<GitHubUser> {
    const clientId = this.getOAuthClientId();
    const deadline = expiresAt ? new Date(expiresAt).getTime() : Date.now() + 15 * 60 * 1000;
    let pollInterval = Math.max(interval, 1);

    while (Date.now() < deadline) {
      const data = await this.postGitHubOAuth('https://github.com/login/oauth/access_token', {
        client_id: clientId,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      });

      if (data.access_token) {
        return await this.authenticateWithToken(
          data.access_token,
          'browser',
          typeof data.scope === 'string' ? data.scope.split(',').filter(Boolean) : []
        );
      }

      if (data.error === 'authorization_pending') {
        await this.sleep(pollInterval * 1000);
        continue;
      }

      if (data.error === 'slow_down') {
        pollInterval += 5;
        await this.sleep(pollInterval * 1000);
        continue;
      }

      throw new Error(data.error_description || data.error || 'GitHub browser sign-in failed.');
    }

    throw new Error('GitHub browser sign-in expired. Please try again.');
  }

  /**
   * Authenticate with Personal Access Token
   */
  async authenticateWithToken(
    token: string,
    authMethod: 'browser' | 'token' = 'token',
    scopes: string[] = []
  ): Promise<GitHubUser> {
    try {
      const OctokitClass = await this.getOctokit();
      this.octokit = new OctokitClass({ auth: token });
      
      // Verify token by getting user info
      const { data: user } = await this.octokit.users.getAuthenticated();
      
      this.credentials = {
        token,
        username: user.login,
        authMethod,
        scopes
      };
      
      this.saveCredentials();
      
      console.log('[GitHubService] Authenticated as:', user.login);
      
      return {
        login: user.login,
        name: user.name || user.login,
        email: user.email || '',
        avatarUrl: user.avatar_url
      };
    } catch (error) {
      console.error('[GitHubService] Authentication failed:', error);
      this.octokit = null;
      this.credentials = null;
      throw error;
    }
  }

  /**
   * Sign out
   */
  signOut(): void {
    this.octokit = null;
    this.credentials = null;
    
    try {
      if (existsSync(this.credentialsFile)) {
        writeFileSync(this.credentialsFile, '{}');
      }
      console.log('[GitHubService] Signed out');
    } catch (error) {
      console.error('[GitHubService] Failed to clear credentials:', error);
    }
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.octokit !== null && this.credentials !== null;
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<GitHubUser | null> {
    if (!this.octokit) {
      return null;
    }

    try {
      const { data: user } = await this.octokit.users.getAuthenticated();
      return {
        login: user.login,
        name: user.name || user.login,
        email: user.email || '',
        avatarUrl: user.avatar_url
      };
    } catch (error) {
      console.error('[GitHubService] Failed to get current user:', error);
      return null;
    }
  }

  /**
   * Get user's repositories
   */
  async getRepositories(): Promise<GitHubRepository[]> {
    if (!this.octokit) {
      throw new Error('Not authenticated');
    }

    try {
      const { data: repos } = await this.octokit.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100
      });

      return repos.map((repo: any) => ({
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || '',
        private: repo.private,
        url: repo.html_url,
        cloneUrl: repo.clone_url,
        defaultBranch: repo.default_branch
      }));
    } catch (error) {
      console.error('[GitHubService] Failed to get repositories:', error);
      throw error;
    }
  }

  /**
   * Create a new repository
   */
  async createRepository(name: string, description: string, isPrivate: boolean): Promise<GitHubRepository> {
    if (!this.octokit) {
      throw new Error('Not authenticated');
    }

    try {
      const { data: repo } = await this.octokit.repos.createForAuthenticatedUser({
        name,
        description,
        private: isPrivate,
        auto_init: true
      });

      console.log('[GitHubService] Created repository:', repo.full_name);

      return {
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || '',
        private: repo.private,
        url: repo.html_url,
        cloneUrl: repo.clone_url,
        defaultBranch: repo.default_branch
      };
    } catch (error) {
      console.error('[GitHubService] Failed to create repository:', error);
      throw error;
    }
  }

  /**
   * Get pull requests for a repository
   */
  async getPullRequests(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubPullRequest[]> {
    if (!this.octokit) {
      throw new Error('Not authenticated');
    }

    try {
      const { data: prs } = await this.octokit.pulls.list({
        owner,
        repo,
        state,
        per_page: 50
      });

      return prs.map((pr: any) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        author: pr.user?.login || 'unknown',
        createdAt: pr.created_at,
        url: pr.html_url
      }));
    } catch (error) {
      console.error('[GitHubService] Failed to get pull requests:', error);
      throw error;
    }
  }

  /**
   * Create a pull request
   */
  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body?: string
  ): Promise<GitHubPullRequest> {
    if (!this.octokit) {
      throw new Error('Not authenticated');
    }

    try {
      const { data: pr } = await this.octokit.pulls.create({
        owner,
        repo,
        title,
        head,
        base,
        body
      });

      console.log('[GitHubService] Created pull request:', pr.number);

      return {
        number: pr.number,
        title: pr.title,
        state: pr.state,
        author: pr.user?.login || 'unknown',
        createdAt: pr.created_at,
        url: pr.html_url
      };
    } catch (error) {
      console.error('[GitHubService] Failed to create pull request:', error);
      throw error;
    }
  }

  /**
   * Fork a repository
   */
  async forkRepository(owner: string, repo: string): Promise<GitHubRepository> {
    if (!this.octokit) {
      throw new Error('Not authenticated');
    }

    try {
      const { data: fork } = await this.octokit.repos.createFork({
        owner,
        repo
      });

      console.log('[GitHubService] Forked repository:', fork.full_name);

      return {
        name: fork.name,
        fullName: fork.full_name,
        description: fork.description || '',
        private: fork.private,
        url: fork.html_url,
        cloneUrl: fork.clone_url,
        defaultBranch: fork.default_branch
      };
    } catch (error) {
      console.error('[GitHubService] Failed to fork repository:', error);
      throw error;
    }
  }

  /**
   * Get repository info from remote URL
   */
  parseGitHubUrl(url: string): { owner: string; repo: string } | null {
    try {
      // Match GitHub URLs like:
      // https://github.com/owner/repo.git
      // git@github.com:owner/repo.git
      const sshMatch = url.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
      if (sshMatch) {
        return {
          owner: sshMatch[1],
          repo: sshMatch[2].replace(/\.git$/, '')
        };
      }

      const normalized = url.includes('://') ? url : `https://${url}`;
      const parsed = new URL(normalized);
      if (parsed.hostname !== 'github.com') {
        return null;
      }

      const [owner, repo] = parsed.pathname.replace(/^\/+/, '').split('/');
      if (owner && repo) {
        return {
          owner,
          repo: repo.replace(/\.git$/, '')
        };
      }

      return null;
    } catch (error) {
      console.error('[GitHubService] Failed to parse GitHub URL:', error);
      return null;
    }
  }

  /**
   * Invite a GitHub user to collaborate on a repository.
   */
  async inviteCollaborator(
    owner: string,
    repo: string,
    username: string,
    permission: 'pull' | 'triage' | 'push' | 'maintain' | 'admin' = 'push'
  ): Promise<GitHubCollaboratorInvite> {
    if (!this.octokit) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await this.octokit.repos.addCollaborator({
        owner,
        repo,
        username,
        permission
      });

      const invitation = response.data || null;
      const status = response.status === 204 ? 'already_collaborator' : 'invited';

      console.log('[GitHubService] Collaborator invite result:', username, status);

      return {
        username,
        permission,
        status,
        invitationUrl: invitation?.html_url
      };
    } catch (error) {
      console.error('[GitHubService] Failed to invite collaborator:', error);
      throw error;
    }
  }

  /**
   * List collaborators for a repository.
   */
  async getCollaborators(owner: string, repo: string): Promise<GitHubCollaborator[]> {
    if (!this.octokit) {
      throw new Error('Not authenticated');
    }

    try {
      const { data } = await this.octokit.repos.listCollaborators({
        owner,
        repo,
        per_page: 100
      });

      return data.map((collaborator: any) => ({
        login: collaborator.login,
        avatarUrl: collaborator.avatar_url,
        permissions: collaborator.permissions || {}
      }));
    } catch (error) {
      console.error('[GitHubService] Failed to get collaborators:', error);
      throw error;
    }
  }

  /**
   * Get credentials for Git operations
   */
  getCredentials(): GitHubCredentials | null {
    return this.credentials;
  }
}

export default new GitHubService();
