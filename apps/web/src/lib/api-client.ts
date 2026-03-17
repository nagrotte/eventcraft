import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' }
});

// Attach Cognito JWT to every request
apiClient.interceptors.request.use(async config => {
  try {
    const session = await fetchAuthSession();
    const token   = session.tokens?.idToken?.toString();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {
    // Not signed in — request goes without auth header
  }
  return config;
});

export default apiClient;
