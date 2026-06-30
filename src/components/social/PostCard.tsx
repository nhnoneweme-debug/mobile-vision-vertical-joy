import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Eye,
  Flame,
  MapPin,
  MessageCircle,
  Send,
  Sparkles,
  Swords,
  Users as UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  commentOnPost,
  listComments,
  listSilentViewers,
  reactToPost,
  registerView,
  type FeedPost,
} from "@/lib/feed";
import {
  getRsvpCounts,
  setRsvp,
  type EventCounts,
  type RsvpStatus,
} from "@/lib/post-events";
import { isCrystalActive } from "@/lib/crystals";

export function PostCard({ post, onChange }: { post: FeedPost; onChange?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const viewed = useRef(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Awaited<ReturnType<typeof listComments>>>([]);
  const [commentBody, setCommentBody] = useState("");
  const [showViewers, setShowViewers] = useState(false);
  const [silentViewers, setSilentViewers] = useState<Awaited<ReturnType<typeof listSilentViewers>>>([]);
  const [oracleActive, setOracleActive] = useState(false);

  useEffect(() => {
    isCrystalActive("oracle_eye").then(setOracleActive);
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !viewed.current) {
            viewed.current = true;
            setTimeout(() => {
              void registerView(post.id);
            }, 2000);
          }
        });
      },
      { threshold: 0.5 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [post.id]);

  const loadComments = async () => {
    setComments(await listComments(post.id));
  };

  return (
    <article ref={ref} className="rounded-2xl border border-border bg-charcoal-900/30 p-4">
      <header className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-ember/20 ring-1 ring-ember/40" />
        <div className="flex-1">
          <p className="text-sm text-foreground">{post.author?.display_name ?? "Viajante"}</p>
          <p className="text-[11px] text-muted-foreground">
            {new Date(post.created_at).toLocaleString("pt-BR")}
          </p>
        </div>
      </header>

      {post.event ? <EventBlock postId={post.id} event={post.event} /> : null}

      {post.body ? (
        <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{post.body}</p>
      ) : null}

      {post.signed_media_url && post.media_type === "image" ? (
        <img
          src={post.signed_media_url}
          alt=""
          className="mt-3 max-h-[420px] w-full rounded-xl object-cover"
        />
      ) : null}
      {post.signed_media_url && post.media_type === "video" ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          src={post.signed_media_url}
          controls
          playsInline
          className="mt-3 max-h-[420px] w-full rounded-xl bg-black"
        />
      ) : null}

      <div className="mt-3 flex items-center gap-3 text-muted-foreground">
        <ReactBtn
          label="Brasa"
          Icon={Flame}
          count={post.reactions_count ?? 0}
          active={post.my_reaction === "ember"}
          onClick={async () => {
            try {
              await reactToPost(post.id, "ember");
              onChange?.();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Falha");
            }
          }}
        />
        <ReactBtn
          label="Insight"
          Icon={Sparkles}
          count={0}
          active={post.my_reaction === "insight"}
          onClick={async () => {
            await reactToPost(post.id, "insight");
            onChange?.();
          }}
        />
        <ReactBtn
          label="Força"
          Icon={Swords}
          count={0}
          active={post.my_reaction === "strength"}
          onClick={async () => {
            await reactToPost(post.id, "strength");
            onChange?.();
          }}
        />

        <button
          type="button"
          onClick={() => {
            const next = !showComments;
            setShowComments(next);
            if (next) void loadComments();
          }}
          className="ml-auto flex items-center gap-1 text-xs"
        >
          <MessageCircle className="h-4 w-4" />
          {post.comments_count ?? 0}
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!oracleActive) {
              toast.info("Ative o Olho do Oráculo para ver quem visualizou.");
              return;
            }
            setShowViewers((v) => !v);
            if (!showViewers) setSilentViewers(await listSilentViewers(post.id));
          }}
          className="flex items-center gap-1 text-xs"
        >
          <Eye className={"h-4 w-4 " + (oracleActive ? "text-fuchsia-300" : "")} />
          {post.views_count ?? 0}
        </button>
      </div>

      {showViewers && oracleActive ? (
        <div className="mt-3 rounded-xl border border-fuchsia-400/40 bg-fuchsia-400/5 p-3">
          <p className="font-display text-[10px] tracking-[0.22em] text-fuchsia-300">
            VIEWERS SILENCIOSOS
          </p>
          {silentViewers.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">Ninguém visualizou em silêncio.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-xs">
              {silentViewers.map((v) => (
                <li key={v.viewer_id} className="text-foreground">
                  {v.profile?.display_name ?? "Viajante"}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {showComments ? (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {comments.map((c) => (
            <div key={c.id} className="text-xs">
              <span className="text-foreground">{c.author?.display_name ?? "Viajante"}: </span>
              <span className="text-muted-foreground">{c.body}</span>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Comentar..."
              className="flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-xs text-foreground outline-none"
            />
            <button
              type="button"
              onClick={async () => {
                if (!commentBody.trim()) return;
                await commentOnPost(post.id, commentBody);
                setCommentBody("");
                await loadComments();
                onChange?.();
              }}
              className="rounded-lg bg-ember px-3 text-charcoal-900"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function ReactBtn({
  Icon,
  count,
  active,
  onClick,
  label,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  count: number;
  active?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex items-center gap-1 text-xs transition " + (active ? "text-ember" : "")
      }
      aria-label={label}
    >
      <Icon className="h-4 w-4" />
      {count > 0 ? count : null}
    </button>
  );
}

function EventBlock({
  postId,
  event,
}: {
  postId: string;
  event: NonNullable<FeedPost["event"]>;
}) {
  const [counts, setCounts] = useState<EventCounts | null>(null);

  const load = async () => setCounts(await getRsvpCounts(postId));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const start = new Date(event.starts_at);
  const dateLabel = start.toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const choose = async (status: RsvpStatus) => {
    try {
      await setRsvp(postId, status);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no RSVP");
    }
  };

  const RsvpBtn = ({ status, label }: { status: RsvpStatus; label: string }) => {
    const active = counts?.my_status === status;
    return (
      <button
        type="button"
        onClick={() => choose(status)}
        className={
          "flex-1 rounded-full border px-2 py-1.5 font-display text-[10px] tracking-[0.18em] transition " +
          (active
            ? "border-ember bg-ember text-charcoal-900"
            : "border-border text-muted-foreground")
        }
      >
        {label}
      </button>
    );
  };

  return (
    <div className="mt-3 rounded-xl border border-ember/30 bg-ember/5 p-3">
      <p className="font-display text-base tracking-wide text-foreground">{event.title}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <CalendarDays className="h-3 w-3" /> {dateLabel}
        </span>
        {event.location_text ? (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {event.location_text}
          </span>
        ) : null}
        <span className="flex items-center gap-1">
          <UsersIcon className="h-3 w-3" /> {counts?.going ?? 0}
          {event.capacity ? `/${event.capacity}` : ""}
        </span>
      </div>
      <div className="mt-3 flex gap-2">
        <RsvpBtn status="going" label="VOU" />
        <RsvpBtn status="maybe" label="TALVEZ" />
        <RsvpBtn status="declined" label="NÃO POSSO" />
      </div>
    </div>
  );
}
