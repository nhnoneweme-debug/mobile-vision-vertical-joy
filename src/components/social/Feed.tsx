import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { listFeed, type FeedPost } from "@/lib/feed";
import { PostComposer } from "./PostComposer";
import { PostCard } from "./PostCard";

export function Feed({ userId }: { userId: string }) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setPosts(await listFeed(30));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-4">
      <PostComposer userId={userId} onPosted={refresh} />
      {loading ? (
        <div className="flex justify-center py-6 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nada por aqui ainda. Seja o primeiro a soltar uma brasa.
        </p>
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} onChange={refresh} />)
      )}
    </div>
  );
}
