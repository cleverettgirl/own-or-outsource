// Claude's real answer to the React starter question (Christine ran the same prompt in Claude, 2026-10-23).
// Verbatim; only the markdown the paste dropped is restored: code fences, the two headings, bullet markers.
// The React starter replays it; any part can be owned.
export const REACT_QUESTION = 'How do I fetch a user by id in a React component when it mounts, and refetch when the id changes?';

export const REACT_TURNS = [
  {
    user: REACT_QUESTION,
    claude: `Use useEffect with the id in the dependency array. The effect runs on mount and again whenever userId changes. The main thing to get right is cleanup, so a slow response for an old id can’t overwrite a newer one.

\`\`\`jsx
import { useState, useEffect } from "react";

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchUser() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(\`/api/users/\${userId}\`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(\`Request failed: \${res.status}\`);
        const data = await res.json();
        setUser(data);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchUser();

    return () => controller.abort();
  }, [userId]);

  if (loading) return <p>Loading…</p>;
  if (error) return <p>Something went wrong: {error.message}</p>;
  if (!user) return null;

  return <h1>{user.name}</h1>;
}
\`\`\`

## How it works

- \`[userId]\` in the dependency array tells React to rerun the effect when the id changes (and on first mount).
- The cleanup function (\`controller.abort()\`) runs before the next effect and on unmount. It cancels the in-flight request, which prevents race conditions and “state update on unmounted component” problems.
- \`AbortError\` is expected when you cancel, so it’s ignored rather than treated as a real error.
- \`fetch\` doesn’t reject on HTTP errors like 404 or 500, which is why the \`res.ok\` check is there.

## Notes

- In development with React Strict Mode, effects run twice on mount. The abort cleanup makes this harmless.
- If you use this pattern in several places, extract it into a custom hook like \`useUser(userId)\`.
- For anything beyond a simple case (caching, deduping, retries, background refetching), a library like TanStack Query handles all of this for you:

\`\`\`jsx
import { useQuery } from "@tanstack/react-query";

function UserProfile({ userId }) {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => fetch(\`/api/users/\${userId}\`).then((r) => {
      if (!r.ok) throw new Error(\`Request failed: \${r.status}\`);
      return r.json();
    }),
  });

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p>Something went wrong: {error.message}</p>;

  return <h1>{user.name}</h1>;
}
\`\`\`

The queryKey including userId is what triggers the refetch on change, the same idea as the dependency array.`,
  },
];
