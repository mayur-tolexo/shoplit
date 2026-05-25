package creators_test

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mayur-tolexo/shoplit/internal/auth"
	"github.com/mayur-tolexo/shoplit/internal/carts"
	"github.com/mayur-tolexo/shoplit/internal/creators"
	"github.com/mayur-tolexo/shoplit/internal/db"
	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
	"github.com/mayur-tolexo/shoplit/pkg/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// svcEnv bundles everything a service test needs: the creators service, a
// cart service to seed carts, the raw query layer + pool for fixtures.
type svcEnv struct {
	svc      *creators.Service
	cartsSvc *carts.Service
	q        *sqlcgen.Queries
	pool     *pgxpool.Pool
}

func setupSvc(t *testing.T) svcEnv {
	t.Helper()
	pool, dsn := testutil.NewPostgres(t)
	require.NoError(t, db.MigrateUp(dsn, "../db/migrations"))
	q := sqlcgen.New(pool)
	return svcEnv{
		svc:      creators.NewService(q),
		cartsSvc: carts.NewService(q),
		q:        q,
		pool:     pool,
	}
}

// newUser creates a user with a deterministic handle derived from the email
// local-part (see auth.NewUserUpsertFn) and returns the user id.
func newUser(t *testing.T, q *sqlcgen.Queries, sub, email, name string) int64 {
	t.Helper()
	upsert := auth.NewUserUpsertFn(q)
	uid, err := upsert(auth.GoogleUserInfo{Sub: sub, Email: email, Name: name, Picture: "https://x/a.jpg"})
	require.NoError(t, err)
	return uid
}

// publicCart creates a public cart owned by uid and returns it.
func publicCart(t *testing.T, svc *carts.Service, uid int64, title string) sqlcgen.Cart {
	t.Helper()
	c, err := svc.CreateCart(context.Background(), uid, title)
	require.NoError(t, err)
	return c
}

// makePrivate flips a cart to private visibility.
func makePrivate(t *testing.T, svc *carts.Service, uid, cartID int64) {
	t.Helper()
	priv := "private"
	_, err := svc.UpdateCart(context.Background(), uid, cartID, carts.UpdatePatch{Visibility: &priv})
	require.NoError(t, err)
}

// seedViews inserts a cart_views_daily row with an explicit count for today.
func seedViews(t *testing.T, pool *pgxpool.Pool, cartID int64, views int) {
	t.Helper()
	_, err := pool.Exec(context.Background(),
		`INSERT INTO cart_views_daily (cart_id, day, views) VALUES ($1, current_date, $2)
		 ON CONFLICT (cart_id, day) DO UPDATE SET views = $2`, cartID, views)
	require.NoError(t, err)
}

// banUser sets banned_at so the user is excluded from discover/search.
func banUser(t *testing.T, pool *pgxpool.Pool, uid int64) {
	t.Helper()
	_, err := pool.Exec(context.Background(),
		`UPDATE users SET banned_at = now() WHERE id = $1`, uid)
	require.NoError(t, err)
}

func TestService_FollowUnfollowAndCount(t *testing.T) {
	env := setupSvc(t)
	ctx := context.Background()
	follower := newUser(t, env.q, "g-f", "follower@example.com", "Follower")
	creator := newUser(t, env.q, "g-c", "creator@example.com", "Creator")
	creatorHandle := "creator"

	// Follow → count 1.
	count, err := env.svc.Follow(ctx, follower, creatorHandle)
	require.NoError(t, err)
	assert.Equal(t, int64(1), count)

	// Idempotent double-follow stays at 1 row.
	count, err = env.svc.Follow(ctx, follower, creatorHandle)
	require.NoError(t, err)
	assert.Equal(t, int64(1), count)

	assert.True(t, env.svc.IsFollowing(ctx, follower, creator))

	// Unfollow → count 0.
	count, err = env.svc.Unfollow(ctx, follower, creatorHandle)
	require.NoError(t, err)
	assert.Equal(t, int64(0), count)
	assert.False(t, env.svc.IsFollowing(ctx, follower, creator))

	// Unfollow of a non-followed creator is a no-op (still 0).
	count, err = env.svc.Unfollow(ctx, follower, creatorHandle)
	require.NoError(t, err)
	assert.Equal(t, int64(0), count)
}

func TestService_SelfFollowRejected(t *testing.T) {
	env := setupSvc(t)
	uid := newUser(t, env.q, "g-self", "selfy@example.com", "Selfy")
	_, err := env.svc.Follow(context.Background(), uid, "selfy")
	assert.ErrorIs(t, err, creators.ErrSelfFollow)
}

func TestService_FollowUnknownHandle(t *testing.T) {
	env := setupSvc(t)
	uid := newUser(t, env.q, "g-u", "user@example.com", "User")
	_, err := env.svc.Follow(context.Background(), uid, "nobody-here")
	assert.ErrorIs(t, err, creators.ErrNotFound)
}

func TestService_DiscoverOnlyCreatorsWithPublicCarts(t *testing.T) {
	env := setupSvc(t)
	ctx := context.Background()

	withPublic := newUser(t, env.q, "g-1", "alice@example.com", "Alice")
	privateOnly := newUser(t, env.q, "g-2", "bob@example.com", "Bob")
	_ = newUser(t, env.q, "g-3", "carol@example.com", "Carol") // no carts at all

	publicCart(t, env.cartsSvc, withPublic, "Alice Public")
	pc := publicCart(t, env.cartsSvc, privateOnly, "Bob Secret")
	makePrivate(t, env.cartsSvc, privateOnly, pc.ID)

	rows, err := env.svc.DiscoverCreators(ctx, 50, 0)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, withPublic, rows[0].ID)
	assert.Equal(t, int64(1), rows[0].CartCount)
}

func TestService_DiscoverOrderedBy7dViews(t *testing.T) {
	env := setupSvc(t)
	ctx := context.Background()

	low := newUser(t, env.q, "g-low", "low@example.com", "Low")
	high := newUser(t, env.q, "g-high", "high@example.com", "High")

	lowCart := publicCart(t, env.cartsSvc, low, "Low Cart")
	highCart := publicCart(t, env.cartsSvc, high, "High Cart")
	seedViews(t, env.pool, lowCart.ID, 3)
	seedViews(t, env.pool, highCart.ID, 99)

	rows, err := env.svc.DiscoverCreators(ctx, 50, 0)
	require.NoError(t, err)
	require.Len(t, rows, 2)
	assert.Equal(t, high, rows[0].ID, "highest 7-day views should rank first")
	assert.Equal(t, int64(99), rows[0].Views7d)
	assert.Equal(t, low, rows[1].ID)
}

// containsID reports whether any row has the given user id.
func containsID(rows []sqlcgen.DiscoverCreatorsRow, id int64) bool {
	for _, r := range rows {
		if r.ID == id {
			return true
		}
	}
	return false
}

func TestService_SearchByHandleSubstring(t *testing.T) {
	env := setupSvc(t)
	ctx := context.Background()

	// Handle is derived from the email local-part: "zelda".
	match := newUser(t, env.q, "g-z", "zelda@example.com", "Z. Person")
	other := newUser(t, env.q, "g-o", "frank@example.com", "Frank")
	publicCart(t, env.cartsSvc, match, "Z Cart")
	publicCart(t, env.cartsSvc, other, "F Cart")

	// "eld" is a substring of the handle "zelda" but not of "frank".
	rows, err := env.svc.SearchCreators(ctx, "eld", 50, 0)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, match, rows[0].ID)
}

func TestService_SearchByDisplayNameCaseInsensitive(t *testing.T) {
	env := setupSvc(t)
	ctx := context.Background()

	match := newUser(t, env.q, "g-d", "user1@example.com", "Aurora Borealis")
	other := newUser(t, env.q, "g-d2", "user2@example.com", "Frank")
	publicCart(t, env.cartsSvc, match, "A Cart")
	publicCart(t, env.cartsSvc, other, "F Cart")

	// Lowercase query matches the display name "Aurora Borealis" case-insensitively
	// (and does not match the handle "user1").
	rows, err := env.svc.SearchCreators(ctx, "aurora", 50, 0)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, match, rows[0].ID)
}

func TestService_SearchPrefixRanksAboveSubstring(t *testing.T) {
	env := setupSvc(t)
	ctx := context.Background()

	// "sunshine" → prefix match on "sun"; "midsun" → mere substring match on "sun".
	prefix := newUser(t, env.q, "g-pre", "sunshine@example.com", "Sunshine")
	substr := newUser(t, env.q, "g-sub", "midsun@example.com", "Midsun")
	prefixCart := publicCart(t, env.cartsSvc, prefix, "Prefix Cart")
	substrCart := publicCart(t, env.cartsSvc, substr, "Substr Cart")

	// Give the substring match MORE 7-day views so only the prefix-first ORDER BY
	// (not popularity) can explain it ranking ahead.
	seedViews(t, env.pool, prefixCart.ID, 1)
	seedViews(t, env.pool, substrCart.ID, 99)

	rows, err := env.svc.SearchCreators(ctx, "sun", 50, 0)
	require.NoError(t, err)
	require.Len(t, rows, 2)
	assert.Equal(t, prefix, rows[0].ID, "prefix match ranks above substring despite fewer views")
	assert.Equal(t, substr, rows[1].ID)
}

func TestService_SearchExcludesPrivateOnlyAndBanned(t *testing.T) {
	env := setupSvc(t)
	ctx := context.Background()

	// All three share the "nova" token but only one is a discoverable creator.
	withPublic := newUser(t, env.q, "g-np", "nova-pub@example.com", "Nova Public")
	privateOnly := newUser(t, env.q, "g-nv", "nova-priv@example.com", "Nova Private")
	banned := newUser(t, env.q, "g-nb", "nova-ban@example.com", "Nova Banned")

	publicCart(t, env.cartsSvc, withPublic, "Nova Pub Cart")
	pc := publicCart(t, env.cartsSvc, privateOnly, "Nova Secret")
	makePrivate(t, env.cartsSvc, privateOnly, pc.ID)
	publicCart(t, env.cartsSvc, banned, "Nova Banned Cart")
	banUser(t, env.pool, banned)

	rows, err := env.svc.SearchCreators(ctx, "nova", 50, 0)
	require.NoError(t, err)
	require.Len(t, rows, 1, "only the creator with a public cart, not banned")
	assert.Equal(t, withPublic, rows[0].ID)
	assert.False(t, containsID(rows, privateOnly))
	assert.False(t, containsID(rows, banned))
}

func TestService_SearchEscapesWildcards(t *testing.T) {
	env := setupSvc(t)
	ctx := context.Background()

	a := newUser(t, env.q, "g-w1", "alpha@example.com", "Alpha")
	b := newUser(t, env.q, "g-w2", "bravo@example.com", "Bravo")
	publicCart(t, env.cartsSvc, a, "Alpha Cart")
	publicCart(t, env.cartsSvc, b, "Bravo Cart")

	// A bare "%" must be treated as a literal (escaped), not a match-all wildcard.
	rows, err := env.svc.SearchCreators(ctx, "%", 50, 0)
	require.NoError(t, err)
	assert.Empty(t, rows, "literal %% should not match every creator")
	assert.False(t, containsID(rows, a))
	assert.False(t, containsID(rows, b))

	// "_" is likewise literal: it must not single-character-wildcard-match.
	rows, err = env.svc.SearchCreators(ctx, "_", 50, 0)
	require.NoError(t, err)
	assert.Empty(t, rows, "literal _ should not match")
}

func TestService_GetCreatorProfile(t *testing.T) {
	env := setupSvc(t)
	ctx := context.Background()

	creator := newUser(t, env.q, "g-prof", "priya@example.com", "Priya")
	viewer := newUser(t, env.q, "g-view", "viewer@example.com", "Viewer")

	pub := publicCart(t, env.cartsSvc, creator, "Visible")
	_ = pub
	privC := publicCart(t, env.cartsSvc, creator, "Hidden")
	makePrivate(t, env.cartsSvc, creator, privC.ID)
	archived := publicCart(t, env.cartsSvc, creator, "Gone")
	require.NoError(t, env.cartsSvc.DeleteCart(ctx, creator, archived.ID))

	// Viewer follows the creator first so isFollowing is true.
	_, err := env.svc.Follow(ctx, viewer, "priya")
	require.NoError(t, err)

	profile, cartsJSON, err := env.svc.GetCreatorProfile(ctx, "priya", viewer)
	require.NoError(t, err)
	assert.Equal(t, "priya", profile.Handle)
	assert.Equal(t, 1, profile.CartCount, "only the public, non-archived cart counts")
	assert.Equal(t, 1, profile.FollowerCount)
	assert.True(t, profile.IsFollowing)
	require.Len(t, cartsJSON, 1)
	assert.Equal(t, "Visible", cartsJSON[0].Title)
	// Public context must not leak analytics.
	assert.Equal(t, 0, cartsJSON[0].ViewsLast7d)
}

func TestService_GetCreatorProfile_UnknownHandle(t *testing.T) {
	env := setupSvc(t)
	_, _, err := env.svc.GetCreatorProfile(context.Background(), "ghost", 0)
	assert.ErrorIs(t, err, creators.ErrNotFound)
}

func TestService_FollowingFeed(t *testing.T) {
	env := setupSvc(t)
	ctx := context.Background()

	follower := newUser(t, env.q, "g-me", "me@example.com", "Me")
	followed := newUser(t, env.q, "g-fd", "star@example.com", "Star")
	other := newUser(t, env.q, "g-ot", "other@example.com", "Other")

	// followed: one public (newest) + one private; other: one public.
	first := publicCart(t, env.cartsSvc, followed, "First")
	_ = first
	priv := publicCart(t, env.cartsSvc, followed, "Private")
	makePrivate(t, env.cartsSvc, followed, priv.ID)
	second := publicCart(t, env.cartsSvc, followed, "Second")
	_ = second
	publicCart(t, env.cartsSvc, other, "Other Public")

	_, err := env.svc.Follow(ctx, follower, "star")
	require.NoError(t, err)

	feed, err := env.svc.FollowingFeed(ctx, follower, 50, 0)
	require.NoError(t, err)
	require.Len(t, feed, 2, "only followed creator's public carts")
	// Newest first (Second created after First).
	assert.Equal(t, "Second", feed[0].Title)
	assert.Equal(t, "First", feed[1].Title)
	for _, c := range feed {
		assert.NotEqual(t, "Private", c.Title)
		assert.NotEqual(t, "Other Public", c.Title)
		assert.Equal(t, 0, c.ViewsLast7d, "feed must not leak analytics")
	}
}

func TestService_FollowingFeedEmpty(t *testing.T) {
	env := setupSvc(t)
	follower := newUser(t, env.q, "g-lonely", "lonely@example.com", "Lonely")
	feed, err := env.svc.FollowingFeed(context.Background(), follower, 50, 0)
	require.NoError(t, err)
	assert.Empty(t, feed)
}
