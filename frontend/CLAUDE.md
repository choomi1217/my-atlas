# Frontend: React 18 + TypeScript + Vite

This file governs all frontend development. **Always reference this when making changes to `/frontend`.**

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|------------|
| **Language** | TypeScript |
| **Framework** | React 18 |
| **Build Tool** | Vite 5 |
| **Package Manager** | npm |
| **Styling** | Tailwind CSS 3 |
| **HTTP Client** | axios |
| **Routing** | react-router-dom v6 |
| **State Management** | React Context / hooks (no Redux) |
| **CSS Framework** | Tailwind (utility-first, no custom CSS when possible) |
| **Development Server** | Vite dev server with HMR |
| **Code Formatting** | Prettier (optional, configure in `.prettierrc`) |
| **Linting** | ESLint (if configured) |

---

## 🛠️ Commands

All commands run from `/frontend` directory via npm.

### Install Dependencies
```bash
npm install
# Installs all packages from package.json into node_modules/
```

### Development Server
```bash
npm run dev
# Starts Vite dev server (usually http://localhost:5173)
# Hot module replacement enabled — changes reflect instantly
```

### Build for Production
```bash
npm run build
# Compiles TypeScript, bundles React code, outputs to dist/
# Optimized for production (minified, tree-shaken)
```

### Preview Production Build
```bash
npm run preview
# Locally serves the built dist/ directory
# Useful to test production bundle before deploy
```

### Run Tests (if configured)
```bash
npm test
# Runs Jest / Vitest suite
# Reports: coverage/ directory (if enabled)
```

### Linting (if configured)
```bash
npm run lint
# Runs ESLint on src/ directory
```

---

## 📂 Directory Structure

```
frontend/src/
├── main.tsx                    # React entry point (React.createRoot)
├── App.tsx                     # Root component, router setup
├── index.css                   # Global Tailwind imports (@tailwind directives)
├── components/                 # Reusable UI components
│   ├── Layout.tsx              # Shared header/footer/sidebar wrapper
│   ├── Header.tsx
│   ├── Footer.tsx
│   └── ...other shared components
├── pages/                      # Route-specific page components
│   ├── SeniorPage.tsx          # AI chat page (route: /)
│   ├── KnowledgeBasePage.tsx   # KB page (route: /kb)
│   ├── ConventionsPage.tsx     # Conventions (route: /conventions)
│   └── FeaturesPage.tsx        # Features (route: /features)
├── hooks/                      # Custom React hooks
│   ├── useSenior.ts            # Custom hook for Senior API calls
│   └── ...
├── stores/                     # State management (Context or Zustand)
│   ├── SeniorContext.tsx       # Example: shared state for senior domain
│   └── ...
├── api/                        # API client setup & calls
│   ├── client.ts               # Axios instance setup
│   ├── senior.ts               # Senior API endpoints
│   ├── knowledgeBase.ts        # Knowledge Base API endpoints
│   └── ...
├── types/                      # TypeScript interfaces & types
│   ├── senior.ts               # Types for Senior domain
│   ├── knowledgeBase.ts        # Types for KB domain
│   ├── api.ts                  # Generic API types (responses, errors)
│   └── index.ts                # Export all types
├── utils/                      # Utility functions
│   ├── formatters.ts           # Date, currency, text formatting
│   ├── validators.ts           # Form validation logic
│   └── constants.ts            # App-wide constants
└── vite-env.d.ts               # Vite environment types
```

---

## 🏗️ Naming & Code Conventions

### Files & Directories
- **Components:** PascalCase (e.g., `SeniorChat.tsx`, `KnowledgeBaseCard.tsx`)
- **Hooks:** camelCase with `use` prefix (e.g., `useSenior.ts`, `useFetch.ts`)
- **Pages:** PascalCase (e.g., `SeniorPage.tsx`)
- **Utilities:** camelCase (e.g., `formatters.ts`, `validators.ts`)
- **Types/Interfaces:** PascalCase (e.g., `ChatMessage.ts`)
- **API modules:** camelCase domain (e.g., `senior.ts`, `knowledgeBase.ts`)

### Components
- **Always use functional components** (no class components)
- **Single Responsibility Principle:** One primary purpose per component
- **Props typing:**
  ```typescript
  interface SeniorChatProps {
    initialMessage?: string;
    onSendMessage: (msg: string) => void;
    isLoading?: boolean;
  }

  export const SeniorChat: React.FC<SeniorChatProps> = ({
    initialMessage,
    onSendMessage,
    isLoading = false,
  }) => {
    return <div>...</div>;
  };
  ```

- **No inline styles:**
  ```typescript
  // ❌ BAD
  <div style={{ color: 'red', fontSize: '16px' }}>Text</div>

  // ✅ GOOD
  <div className="text-red-500 text-base">Text</div>
  ```

- **Example component:**
  ```typescript
  // components/SeniorChat.tsx
  import { useState } from 'react';
  import { useSenior } from '../hooks/useSenior';
  import { Message } from '../types/senior';

  interface SeniorChatProps {
    onClose: () => void;
  }

  export const SeniorChat: React.FC<SeniorChatProps> = ({ onClose }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const { sendQuery, isLoading } = useSenior();

    const handleSend = async () => {
      if (!input.trim()) return;

      const userMsg: Message = { role: 'user', content: input };
      setMessages(prev => [...prev, userMsg]);
      setInput('');

      const response = await sendQuery(input);
      const aiMsg: Message = { role: 'assistant', content: response.answer };
      setMessages(prev => [...prev, aiMsg]);
    };

    return (
      <div className="flex flex-col h-screen bg-white">
        <div className="flex-1 overflow-y-auto p-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
              {msg.content}
            </div>
          ))}
        </div>
        <div className="p-4 border-t">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type message..."
            className="w-full px-3 py-2 border rounded"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    );
  };
  ```

### TypeScript Types
- **No `any` type** — use `unknown` + type guards if needed
  ```typescript
  // ❌ BAD
  const data: any = response.data;

  // ✅ GOOD
  interface ApiResponse {
    success: boolean;
    data: unknown;
  }

  const handleResponse = (data: unknown) => {
    if (typeof data === 'object' && data !== null && 'id' in data) {
      // Safe to access data.id
    }
  };
  ```

- **Props as `interface`:**
  ```typescript
  // ✅ GOOD
  interface ButtonProps {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  }

  export const Button: React.FC<ButtonProps> = ({ label, onClick, variant = 'primary' }) => {
    return <button onClick={onClick}>{label}</button>;
  };
  ```

- **Domain-specific types in `types/{domain}.ts`:**
  ```typescript
  // types/senior.ts
  export interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: Date;
  }

  export interface ChatResponse {
    id: string;
    answer: string;
    model: string;
  }

  export interface SeniorProfile {
    id: number;
    name: string;
    expertise: string[];
  }
  ```

### Hooks
- **Custom hooks for repeated logic:**
  ```typescript
  // hooks/useSenior.ts
  import { useState, useCallback } from 'react';
  import { seniorApi } from '../api/senior';
  import { ChatResponse } from '../types/senior';

  export const useSenior = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sendQuery = useCallback(async (query: string): Promise<ChatResponse> => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await seniorApi.chat(query);
        return response;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      } finally {
        setIsLoading(false);
      }
    }, []);

    return { sendQuery, isLoading, error };
  };
  ```

### API Client
- **Centralized axios setup in `api/client.ts`:**
  ```typescript
  // api/client.ts
  import axios from 'axios';

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Add response interceptor for error handling
  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      console.error('API Error:', error.response?.data || error.message);
      return Promise.reject(error);
    }
  );
  ```

- **Domain-specific API modules:**
  ```typescript
  // api/senior.ts
  import { apiClient } from './client';
  import { ChatResponse } from '../types/senior';

  export const seniorApi = {
    chat: async (query: string): Promise<ChatResponse> => {
      const response = await apiClient.post('/api/senior/chat', { query });
      return response.data.data; // Assuming ApiResponse<T> wrapper
    },

    getProfile: async (id: number) => {
      const response = await apiClient.get(`/api/senior/${id}`);
      return response.data.data;
    },
  };
  ```

---

## 🔐 Security Guidelines

### Environment Variables
- **API keys go in `.env.local` (never commit):**
  ```
  # .env.local (in .gitignore)
  VITE_API_BASE_URL=http://localhost:8080
  VITE_API_KEY=sk-...  # If frontend needs an API key
  ```

- **Access via `import.meta.env.VARIABLE_NAME`:**
  ```typescript
  const API_KEY = import.meta.env.VITE_API_KEY;
  ```

- **Ensure `.env.local` is in `.gitignore`** (already configured)

### DOM Safety
- **Never use `dangerouslySetInnerHTML`:**
  ```typescript
  // ❌ BAD
  <div dangerouslySetInnerHTML={{ __html: userContent }} />

  // ✅ GOOD — React escapes by default
  <div>{userContent}</div>
  ```

- If you must render HTML (e.g., markdown), use a safe library:
  ```typescript
  import DOMPurify from 'dompurify'; // or use react-markdown
  <div>{DOMPurify.sanitize(htmlContent)}</div>
  ```

### API Communication
- **Always validate API responses:**
  ```typescript
  const handleResponse = (data: unknown) => {
    if (typeof data === 'object' && data !== null && 'success' in data) {
      // Handle response
    }
  };
  ```

- **Use HTTPS in production** (configure in backend CORS & environment)

- **Store sensitive tokens securely:**
  - If using JWT: store in secure, HttpOnly cookie (NOT localStorage if possible)
  - Or: rely on backend session management
  - Do NOT store API keys in localStorage

---

## 🎨 Tailwind CSS Guidelines

- **Use Tailwind utility classes** instead of custom CSS:
  ```typescript
  // ❌ BAD
  <div className="custom-box">Text</div>
  // In CSS: .custom-box { padding: 1rem; background: #fff; ... }

  // ✅ GOOD
  <div className="p-4 bg-white border rounded shadow">Text</div>
  ```

- **Common Tailwind patterns:**
  ```typescript
  // Flexbox layouts
  <div className="flex gap-4">...</div>  // flex row with spacing
  <div className="flex flex-col gap-2">...</div>  // flex column

  // Responsive
  <div className="text-sm md:text-base lg:text-lg">Responsive text</div>

  // Colors & states
  <button className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50">Button</button>

  // Spacing
  <div className="p-4 m-2 gap-3">Padding, margin, gap</div>

  // Grid
  <div className="grid grid-cols-3 gap-4">...</div>
  ```

- **Custom colors in `tailwind.config.js`** (if needed):
  ```javascript
  module.exports = {
    theme: {
      extend: {
        colors: {
          'brand-primary': '#1a73e8',
        },
      },
    },
  };
  ```

---

## ✅ Testing (Optional but Recommended)

If using Vitest + React Testing Library:

```typescript
// __tests__/SeniorChat.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SeniorChat } from '../components/SeniorChat';

describe('SeniorChat', () => {
  it('renders chat input', () => {
    render(<SeniorChat onClose={() => {}} />);
    expect(screen.getByPlaceholderText('Type message...')).toBeInTheDocument();
  });

  it('sends message on button click', () => {
    render(<SeniorChat onClose={() => {}} />);
    const input = screen.getByPlaceholderText('Type message...');
    const button = screen.getByText('Send');

    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(button);

    // Assert: message appears or API is called
  });
});
```

Run: `npm test`

---

## 🚨 Common Pitfalls

1. **Fetching in render without dependency array:**
   ```typescript
   // ❌ BAD — infinite loop
   const MyComponent = () => {
     const [data, setData] = useState([]);
     fetch('/api/data').then(r => setData(r.json()));
     return <div>{data}</div>;
   };

   // ✅ GOOD
   useEffect(() => {
     fetch('/api/data').then(r => setData(r.json()));
   }, []);
   ```

2. **Missing dependencies in useCallback/useMemo:**
   ```typescript
   // ❌ BAD
   const handleClick = useCallback(() => {
     console.log(data);  // data is stale
   }, []);

   // ✅ GOOD
   const handleClick = useCallback(() => {
     console.log(data);
   }, [data]);
   ```

3. **Using index as key in lists:**
   ```typescript
   // ❌ BAD
   {items.map((item, idx) => <div key={idx}>{item}</div>)}

   // ✅ GOOD
   {items.map((item) => <div key={item.id}>{item.name}</div>)}
   ```

4. **Mutating state directly:**
   ```typescript
   // ❌ BAD
   const [items, setItems] = useState([]);
   items.push(newItem);  // Don't mutate!

   // ✅ GOOD
   setItems([...items, newItem]);
   ```

5. **Using `any` type:**
   ```typescript
   // ❌ BAD
   const data: any = response;

   // ✅ GOOD
   interface ApiResponse {
     success: boolean;
     data: unknown;
   }
   ```

---

## 📂 Example: Adding a New Page

Let's say you're adding a `BlogPage`:

### 1. Create Types
```typescript
// types/blog.ts
export interface BlogPost {
  id: number;
  title: string;
  content: string;
  author: string;
  createdAt: string;
}

export interface BlogListResponse {
  posts: BlogPost[];
  total: number;
}
```

### 2. Create API Module
```typescript
// api/blog.ts
import { apiClient } from './client';
import { BlogPost, BlogListResponse } from '../types/blog';

export const blogApi = {
  getPosts: async (): Promise<BlogListResponse> => {
    const response = await apiClient.get('/api/blog');
    return response.data.data;
  },

  getPost: async (id: number): Promise<BlogPost> => {
    const response = await apiClient.get(`/api/blog/${id}`);
    return response.data.data;
  },

  createPost: async (title: string, content: string): Promise<BlogPost> => {
    const response = await apiClient.post('/api/blog', { title, content });
    return response.data.data;
  },
};
```

### 3. Create Custom Hook
```typescript
// hooks/useBlog.ts
import { useState, useEffect } from 'react';
import { blogApi } from '../api/blog';
import { BlogPost } from '../types/blog';

export const useBlog = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoading(true);
      try {
        const data = await blogApi.getPosts();
        setPosts(data.posts);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load posts');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
  }, []);

  return { posts, isLoading, error };
};
```

### 4. Create Page Component
```typescript
// pages/BlogPage.tsx
import { useBlog } from '../hooks/useBlog';
import { BlogPostCard } from '../components/BlogPostCard';

export const BlogPage: React.FC = () => {
  const { posts, isLoading, error } = useBlog();

  if (isLoading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Blog Posts</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map(post => (
          <BlogPostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
};
```

### 5. Add Route in App.tsx
```typescript
// App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { BlogPage } from './pages/BlogPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* existing routes */}
        <Route path="/blog" element={<BlogPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## 🔗 Environment & Configuration

### Vite Config
- File: `vite.config.ts`
- Defines build settings, plugins, HMR behavior
- See `frontend/vite.config.ts` for current setup

### Tailwind Config
- File: `tailwind.config.js`
- Customizes colors, fonts, spacing, plugins
- See `frontend/tailwind.config.js` for current setup

### Environment Variables
- File: `.env.local` (create locally, not in repo)
- Template: `.env` (checked in)
- Access: `import.meta.env.VITE_*`

---

## ✨ Summary

- **Language:** TypeScript
- **Framework:** React 18 (functional components only)
- **Build:** `npm run dev` (dev), `npm run build` (prod)
- **Styling:** Tailwind CSS (no inline styles)
- **API:** axios-based modular client in `api/` directory
- **Types:** `interface` for Props, domain types in `types/` directory
- **Hooks:** Custom hooks in `hooks/`, use `useEffect` + dependency arrays correctly
- **Security:** No `dangerouslySetInnerHTML`, API keys in `.env.local`, validate responses
- **No `any`:** Use `unknown` + type guards or proper types
- **Structure:** `components/`, `pages/`, `hooks/`, `stores/`, `api/`, `types/`, `utils/`
