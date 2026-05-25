// Primary signed-in "app" routes — the surfaces that get the desktop nav rail
// (lg+) and the phone bottom tab bar (< sm). Shared by AppFrame (to render the
// rail + offset content) and NavBar (to hide the redundant drawer trigger on
// desktop exactly where the rail is shown).
export function isAppRoute(pathname: string): boolean {
  return (
    pathname === "/discover" ||
    pathname === "/add" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/u/")
  );
}
