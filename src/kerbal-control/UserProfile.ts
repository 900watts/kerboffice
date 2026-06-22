// UserProfile.ts — Your identity, for the Kerbals to know who they're talking to

const STORAGE_KEY = 'ksc_user_profile';

export interface UserProfileData {
  name: string;
  description: string;
}

const defaults: UserProfileData = { name: '', description: '' };

export const UserProfile = {
  load(): UserProfileData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...defaults };
      return { ...defaults, ...JSON.parse(raw) };
    } catch {
      return { ...defaults };
    }
  },

  save(data: UserProfileData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage full — silently fail
    }
  },

  /** Build a user identity context block for AI prompt injection. */
  buildContext(): string {
    const profile = this.load();
    if (!profile.name && !profile.description) {
      return '';
    }
    const lines: string[] = ['## About the Person You\'re Talking To'];
    if (profile.name) lines.push(`- Name: ${profile.name}`);
    if (profile.description) lines.push(`- Note: ${profile.description}`);
    return lines.join('\n');
  },
};