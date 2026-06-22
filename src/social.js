import { supabase } from "./supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Social data layer — talks to the Phase 1 tables (profiles, posts, follows,
// likes, comments). RLS enforces ownership server-side; these are thin helpers.
// Photo upload (image_url) lands in Phase 2; the feed/follow graph in Phase 3.
// Requires migration 0003_social.sql to be applied first.
// ─────────────────────────────────────────────────────────────────────────────

// ── Profiles ──────────────────────────────────────────────────────────────────
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, handle, display_name, bio, avatar_url, followers_count, following_count, posts_count, allow_replies")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getProfileByHandle(handle) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, handle, display_name, bio, avatar_url, followers_count, following_count, posts_count")
    .ilike("handle", handle)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Update only the editable identity fields. RLS makes sure it's your own row.
export async function updateProfile(userId, { handle, display_name, bio, avatar_url, allow_replies } = {}) {
  const patch = {};
  if (handle !== undefined) patch.handle = handle;
  if (display_name !== undefined) patch.display_name = display_name;
  if (bio !== undefined) patch.bio = bio;
  if (avatar_url !== undefined) patch.avatar_url = avatar_url;
  if (allow_replies !== undefined) patch.allow_replies = allow_replies;
  const { data, error } = await supabase
    .from("profiles").update(patch).eq("id", userId).select().maybeSingle();
  if (error) throw error;
  return data;
}

// Is a handle free? (case-insensitive). Excludes the current user's own handle.
export async function isHandleAvailable(handle, selfId) {
  const { data, error } = await supabase
    .from("profiles").select("id").ilike("handle", handle).limit(1);
  if (error) throw error;
  return !data?.length || data[0].id === selfId;
}

export async function searchProfiles(q, limit = 20) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, handle, display_name, avatar_url, followers_count")
    .or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`)
    .limit(limit);
  if (error) throw error;
  return data || [];
}

// ── Image upload (Phase 2) ────────────────────────────────────────────────────
// Uploads a File/Blob to the public post-images bucket under <uid>/<ts>.<ext>
// and returns its public URL. Requires migration 0006_storage.sql.
export async function uploadPostImage(userId, file) {
  const ext = (file.name?.split(".").pop() || file.type?.split("/")[1] || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("post-images").upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
  if (error) throw error;
  const { data } = supabase.storage.from("post-images").getPublicUrl(path);
  return data.publicUrl;
}

// ── Posts ─────────────────────────────────────────────────────────────────────
const POST_COLS =
  "id, caption, image_url, like_count, comment_count, created_at, author:profiles!posts_author_id_fkey(id, handle, display_name, avatar_url, allow_replies)";

export async function createPost(authorId, { caption = "", image_url = null } = {}) {
  const { data, error } = await supabase
    .from("posts").insert({ author_id: authorId, caption, image_url }).select(POST_COLS).single();
  if (error) throw error;
  return data;
}

export async function updatePost(postId, { caption, image_url } = {}) {
  const patch = {};
  if (caption !== undefined) patch.caption = caption;
  if (image_url !== undefined) patch.image_url = image_url;
  const { data, error } = await supabase
    .from("posts").update(patch).eq("id", postId).select(POST_COLS).single();
  if (error) throw error;
  return data;
}

// Soft delete: moves the post to "Recently deleted" (kept 30 days), not gone.
export async function deletePost(postId) {
  const { error } = await supabase.from("posts").update({ deleted_at: new Date().toISOString() }).eq("id", postId);
  if (error) throw error;
}
export async function restorePost(postId) {
  const { error } = await supabase.from("posts").update({ deleted_at: null }).eq("id", postId);
  if (error) throw error;
}
// Permanent delete (used by "Delete now" + the 30-day auto-purge).
export async function purgePost(postId) {
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw error;
}

export async function archivePost(postId) {
  const { error } = await supabase.from("posts").update({ archived_at: new Date().toISOString() }).eq("id", postId);
  if (error) throw error;
}
export async function unarchivePost(postId) {
  const { error } = await supabase.from("posts").update({ archived_at: null }).eq("id", postId);
  if (error) throw error;
}

// Active posts only (not archived, not deleted) — the public profile grid.
// A single post by id (for shared deep-links). Returns null if missing/deleted.
export async function getPost(postId) {
  const { data, error } = await supabase
    .from("posts").select(POST_COLS).eq("id", postId).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getUserPosts(authorId, limit = 60) {
  const { data, error } = await supabase
    .from("posts").select(POST_COLS).eq("author_id", authorId)
    .is("archived_at", null).is("deleted_at", null)
    .order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getArchivedPosts(authorId, limit = 100) {
  const { data, error } = await supabase
    .from("posts").select(POST_COLS).eq("author_id", authorId)
    .not("archived_at", "is", null).is("deleted_at", null)
    .order("archived_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

// Recently deleted, newest first. Also returns days_left for each (30-day window).
export async function getDeletedPosts(authorId, limit = 100) {
  const { data, error } = await supabase
    .from("posts").select(POST_COLS + ", deleted_at").eq("author_id", authorId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false }).limit(limit);
  if (error) throw error;
  const now = Date.now();
  return (data || []).map(p => ({ ...p, days_left: Math.max(0, 30 - Math.floor((now - new Date(p.deleted_at).getTime()) / 86400000)) }));
}

// Hard-delete anything sitting in the trash longer than 30 days. Run on load.
export async function purgeExpiredDeleted(authorId) {
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  const { error } = await supabase.from("posts").delete()
    .eq("author_id", authorId).not("deleted_at", "is", null).lt("deleted_at", cutoff);
  if (error) throw error;
}

// Home feed: posts from people you follow + your own, newest first, paginated.
// `before` is an ISO timestamp cursor for infinite scroll.
export async function getFeed(userId, { limit = 20, before } = {}) {
  // who do I follow?
  const { data: f, error: fe } = await supabase
    .from("follows").select("followee_id").eq("follower_id", userId);
  if (fe) throw fe;
  const authorIds = [userId, ...(f || []).map(r => r.followee_id)];
  let q = supabase.from("posts").select(POST_COLS)
    .in("author_id", authorIds)
    .is("archived_at", null).is("deleted_at", null)
    .order("created_at", { ascending: false }).limit(limit);
  if (before) q = q.lt("created_at", before);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// ── Follows ───────────────────────────────────────────────────────────────────
export async function follow(followerId, followeeId) {
  const { error } = await supabase.from("follows").insert({ follower_id: followerId, followee_id: followeeId });
  if (error && error.code !== "23505") throw error; // ignore "already following"
}
export async function unfollow(followerId, followeeId) {
  const { error } = await supabase.from("follows")
    .delete().eq("follower_id", followerId).eq("followee_id", followeeId);
  if (error) throw error;
}
export async function isFollowing(followerId, followeeId) {
  const { data, error } = await supabase.from("follows")
    .select("follower_id").eq("follower_id", followerId).eq("followee_id", followeeId).maybeSingle();
  if (error) throw error;
  return !!data;
}

// ── Likes ─────────────────────────────────────────────────────────────────────
export async function like(userId, postId) {
  const { error } = await supabase.from("likes").insert({ user_id: userId, post_id: postId });
  if (error && error.code !== "23505") throw error;
}
export async function unlike(userId, postId) {
  const { error } = await supabase.from("likes").delete().eq("user_id", userId).eq("post_id", postId);
  if (error) throw error;
}
// Which of these post ids has the user liked? Returns a Set for quick lookup.
export async function likedPostIds(userId, postIds = []) {
  if (!postIds.length) return new Set();
  const { data, error } = await supabase.from("likes")
    .select("post_id").eq("user_id", userId).in("post_id", postIds);
  if (error) throw error;
  return new Set((data || []).map(r => r.post_id));
}

// ── Comments ──────────────────────────────────────────────────────────────────
const COMMENT_COLS =
  "id, body, created_at, parent_id, author:profiles!comments_author_id_fkey(id, handle, display_name, avatar_url)";

// Returns top-level comments newest-first, each with a `replies` array (oldest
// first) — the shape the UI renders directly.
export async function getComments(postId, limit = 200) {
  const { data, error } = await supabase
    .from("comments").select(COMMENT_COLS).eq("post_id", postId)
    .order("created_at", { ascending: true }).limit(limit);
  if (error) throw error;
  const rows = data || [];
  const tops = rows.filter(c => !c.parent_id).map(c => ({ ...c, replies: [] }));
  const byId = Object.fromEntries(tops.map(t => [t.id, t]));
  for (const c of rows) if (c.parent_id && byId[c.parent_id]) byId[c.parent_id].replies.push(c);
  return tops.sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export async function addComment(postId, authorId, body, parentId = null) {
  const { data, error } = await supabase
    .from("comments").insert({ post_id: postId, author_id: authorId, body, parent_id: parentId }).select(COMMENT_COLS).single();
  if (error) throw error;
  return data;
}
export async function deleteComment(commentId) {
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) throw error;
}

// ── Activity / insights ─────────────────────────────────────────────────────
// Engagement your account received: likes, comments, (reposts/tags later),
// total interactions, and recent likers/commenters. Excludes deleted posts.
export async function getActivity(userId) {
  const empty = { likeCount: 0, commentCount: 0, repostCount: 0, tagCount: 0, interactions: 0, recentLikes: [], recentComments: [] };
  const { data: mine, error: me } = await supabase
    .from("posts").select("id").eq("author_id", userId).is("deleted_at", null);
  if (me) throw me;
  const ids = (mine || []).map(p => p.id);
  if (!ids.length) return empty;

  const [likeC, commentC, recentLikes, recentComments] = await Promise.all([
    supabase.from("likes").select("*", { count: "exact", head: true }).in("post_id", ids),
    supabase.from("comments").select("*", { count: "exact", head: true }).in("post_id", ids),
    supabase.from("likes").select("created_at, post_id, actor:profiles!likes_user_id_fkey(handle, display_name, avatar_url)").in("post_id", ids).order("created_at", { ascending: false }).limit(20),
    supabase.from("comments").select("created_at, body, post_id, actor:profiles!comments_author_id_fkey(handle, display_name, avatar_url)").in("post_id", ids).order("created_at", { ascending: false }).limit(20),
  ]);
  if (likeC.error) throw likeC.error;
  if (commentC.error) throw commentC.error;
  const likeCount = likeC.count || 0;
  const commentCount = commentC.count || 0;
  return {
    likeCount, commentCount, repostCount: 0, tagCount: 0,
    interactions: likeCount + commentCount,
    recentLikes: recentLikes.data || [],
    recentComments: recentComments.data || [],
  };
}

// ── Direct messages / chat ────────────────────────────────────────────────────
const MSG_COLS =
  "id, sender_id, recipient_id, body, post_id, created_at, read_at, post:posts(id, caption, image_url, author:profiles!posts_author_id_fkey(handle, display_name))";
const PEOPLE = "id, handle, display_name, avatar_url";

export async function sendMessage(senderId, recipientId, { body = null, postId = null } = {}) {
  const { data, error } = await supabase
    .from("messages").insert({ sender_id: senderId, recipient_id: recipientId, body, post_id: postId }).select(MSG_COLS).single();
  if (error) throw error;
  return data;
}

// All messages between two users, oldest first.
export async function getThread(userId, otherId, limit = 200) {
  const { data, error } = await supabase
    .from("messages").select(MSG_COLS)
    .or(`and(sender_id.eq.${userId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${userId})`)
    .order("created_at", { ascending: true }).limit(limit);
  if (error) throw error;
  return data || [];
}

// Conversation list: latest message per other-person + unread count. Derived
// client-side from the user's messages (fine at small scale).
export async function getConversations(userId) {
  const { data, error } = await supabase
    .from("messages").select(MSG_COLS)
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  const rows = data || [];
  const otherIds = [...new Set(rows.map(m => m.sender_id === userId ? m.recipient_id : m.sender_id))];
  let people = {};
  if (otherIds.length) {
    const { data: ps } = await supabase.from("profiles").select(PEOPLE).in("id", otherIds);
    people = Object.fromEntries((ps || []).map(p => [p.id, p]));
  }
  const seen = new Set();
  const convos = [];
  for (const m of rows) {
    const other = m.sender_id === userId ? m.recipient_id : m.sender_id;
    if (seen.has(other)) continue;
    seen.add(other);
    const unread = rows.filter(x => x.sender_id === other && x.recipient_id === userId && !x.read_at).length;
    convos.push({ otherId: other, other: people[other] || { id: other, handle: "user" }, last: m, unread });
  }
  return convos;
}

// Total unread across all conversations (for the nav badge).
export async function unreadTotal(userId) {
  const { count, error } = await supabase
    .from("messages").select("*", { count: "exact", head: true })
    .eq("recipient_id", userId).is("read_at", null);
  if (error) throw error;
  return count || 0;
}

// Mark every message from `otherId` to me as read.
export async function markThreadRead(userId, otherId) {
  const { error } = await supabase.from("messages").update({ read_at: new Date().toISOString() })
    .eq("recipient_id", userId).eq("sender_id", otherId).is("read_at", null);
  if (error) throw error;
}

// ── One-time migration: push locally-stored profile + posts into the tables ─────
// Local posts were { id, caption, image (data URL), createdAt }. We can carry the
// caption over; local data-URL images are dropped (real images upload in Phase 2).
export async function migrateLocalToTables(userId, { profile = {}, posts = [] } = {}) {
  const name = `${profile.first || ""} ${profile.last || ""}`.trim();
  await updateProfile(userId, {
    display_name: name || undefined,
    bio: profile.bio || undefined,
    handle: profile.handle ? profile.handle.replace(/^@/, "") : undefined,
  });
  // oldest first so created order is preserved
  for (const p of [...posts].reverse()) {
    if (!p.caption?.trim()) continue; // skip image-only locals (no uploaded URL yet)
    try { await createPost(userId, { caption: p.caption }); } catch { /* skip dupes/invalid */ }
  }
}
