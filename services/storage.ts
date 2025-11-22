import { User, Project, UserPreferences } from '../types';

const USERS_KEY = 'bayan_users';
const PROJECTS_KEY = 'bayan_projects';
const CURRENT_USER_KEY = 'bayan_current_user_id';
const ONBOARDING_KEY = 'bayan_onboarding_seen';

const DEFAULT_PREFERENCES: UserPreferences = {
  transliterationScheme: 'ISO',
  includeLiteralTranslation: true,
};

export const StorageService = {
  // User Management
  getUsers: (): User[] => {
    const usersStr = localStorage.getItem(USERS_KEY);
    return usersStr ? JSON.parse(usersStr) : [];
  },

  saveUser: (user: User) => {
    const users = StorageService.getUsers();
    const existingIndex = users.findIndex(u => u.id === user.id);
    if (existingIndex >= 0) {
      users[existingIndex] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  login: (username: string): User | null => {
    const users = StorageService.getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, user.id);
      return user;
    }
    return null;
  },

  register: (username: string, email: string): User => {
    const users = StorageService.getUsers();
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      throw new Error('Username already exists');
    }
    
    const newUser: User = {
      id: crypto.randomUUID(),
      username,
      email,
      preferences: DEFAULT_PREFERENCES
    };
    
    StorageService.saveUser(newUser);
    localStorage.setItem(CURRENT_USER_KEY, newUser.id);
    return newUser;
  },

  logout: () => {
    localStorage.removeItem(CURRENT_USER_KEY);
  },

  getCurrentUser: (): User | null => {
    const id = localStorage.getItem(CURRENT_USER_KEY);
    if (!id) return null;
    const users = StorageService.getUsers();
    return users.find(u => u.id === id) || null;
  },

  updatePreferences: (userId: string, prefs: Partial<UserPreferences>) => {
    const users = StorageService.getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index !== -1) {
      users[index].preferences = { ...users[index].preferences, ...prefs };
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      return users[index];
    }
    return null;
  },

  // Project Management
  getProjects: (userId: string): Project[] => {
    const allProjectsStr = localStorage.getItem(PROJECTS_KEY);
    const allProjects: Project[] = allProjectsStr ? JSON.parse(allProjectsStr) : [];
    return allProjects.filter(p => p.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
  },

  saveProject: (project: Project) => {
    const allProjectsStr = localStorage.getItem(PROJECTS_KEY);
    let allProjects: Project[] = allProjectsStr ? JSON.parse(allProjectsStr) : [];
    
    const index = allProjects.findIndex(p => p.id === project.id);
    if (index >= 0) {
      allProjects[index] = project;
    } else {
      allProjects.push(project);
    }
    
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(allProjects));
  },

  deleteProject: (projectId: string) => {
    const allProjectsStr = localStorage.getItem(PROJECTS_KEY);
    let allProjects: Project[] = allProjectsStr ? JSON.parse(allProjectsStr) : [];
    allProjects = allProjects.filter(p => p.id !== projectId);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(allProjects));
  },

  // Onboarding
  getOnboardingStatus: (): boolean => {
    return localStorage.getItem(ONBOARDING_KEY) === 'true';
  },

  saveOnboardingStatus: (seen: boolean) => {
    localStorage.setItem(ONBOARDING_KEY, String(seen));
  }
};