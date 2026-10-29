const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export interface AuthUser { id: string; name: string; email: string; role: string }
export interface AuthResponse { token: string; user: AuthUser }
const TOKEN_KEY = 'datalake_auth_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const logout = () => localStorage.removeItem(TOKEN_KEY);
async function request(path: string, body: unknown): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Unable to authenticate. Please try again.');
  localStorage.setItem(TOKEN_KEY, data.token);
  return data as AuthResponse;
}
export const authApi = {
  login: (email: string, password: string) => request('login', { email, password }),
  register: (name: string, email: string, password: string) => request('register', { name, email, password }),
};
