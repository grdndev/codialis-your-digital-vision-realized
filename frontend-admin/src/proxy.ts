import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

// Garde de premier niveau : elle évite d'afficher une page à un visiteur qui
// n'a aucune session du tout.
//
// Elle ne vérifie PAS la signature du jeton, et c'est volontaire :
// frontend-admin ne connaît pas AUTH_SECRET. La validité réelle est établie par
// le backend à chaque appel — un jeton expiré ou forgé passe donc ici, puis se
// fait refuser en 401, et `apiGet` renvoie l'utilisateur au login.
const PUBLIC_PATHS = new Set(["/login", "/reset", "/verify"]);

// Mémoire d'écran. Deux besoins distincts, un même mécanisme : le navigateur
// garde ce que la personne regardait, et y revient toute seule.
//
// - « Tickets » retient les filtres choisis. Le marqueur `f=1`, posé par tous
//   les liens de filtre, distingue « je n'en veux aucun » d'une arrivée par le
//   menu : sans lui, vider les filtres serait immédiatement défait par la
//   mémoire.
// - « Projets » retient le dernier projet ouvert et y retourne directement.
//   `?liste=1` demande explicitement la liste complète.
const FILTER_MEMORY_PATHS = new Set(["/tickets"]);
const FILTER_COOKIE_PREFIX = "codialis_filtres";
const LAST_PROJECT_COOKIE = "codialis_dernier_projet";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

function filterCookieName(pathname: string): string {
  return `${FILTER_COOKIE_PREFIX}${pathname.replace(/\//g, "_")}`;
}

// Un identifiant de projet et rien d'autre : `/projects/abc` compte,
// `/projects/abc/tasks/def` non — on retient le projet, pas la sous-page.
function projectIdOf(pathname: string): string | null {
  const match = /^\/projects\/([^/]+)$/.exec(pathname);
  return match ? match[1] : null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Trois pages doivent rester accessibles SANS session, sans quoi les
  // parcours par e-mail sont inutilisables : on ne peut pas exiger d'être
  // connecté pour réinitialiser un mot de passe oublié, ni pour confirmer un
  // compte dont le mot de passe n'existe pas encore.
  //
  // `/login` redirige une session déjà valide depuis la page elle-même (voir
  // src/app/login/page.tsx) : le faire ici, sur la seule présence du cookie,
  // provoquerait une boucle avec un cookie périmé — la page rebondirait vers
  // l'app, qui rebondirait au login.
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  if (!request.cookies.get(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const search = request.nextUrl.searchParams;

  if (FILTER_MEMORY_PATHS.has(pathname)) {
    const cookieName = filterCookieName(pathname);
    if (search.has("f")) {
      // Les filtres se retiennent, pas la recherche : retrouver l'écran avec
      // les mots tapés la semaine dernière ne rendrait service à personne.
      const aRetenir = new URLSearchParams(search);
      aRetenir.delete("q");
      const response = NextResponse.next();
      response.cookies.set(cookieName, aRetenir.toString(), {
        maxAge: COOKIE_MAX_AGE,
        sameSite: "lax",
        path: "/",
      });
      return response;
    }
    const remembered = request.cookies.get(cookieName)?.value;
    if (remembered && ![...search.keys()].length) {
      const url = request.nextUrl.clone();
      url.search = remembered;
      return NextResponse.redirect(url);
    }
  }

  const projectId = projectIdOf(pathname);
  if (projectId) {
    const response = NextResponse.next();
    response.cookies.set(LAST_PROJECT_COOKIE, projectId, {
      maxAge: COOKIE_MAX_AGE,
      sameSite: "lax",
      path: "/",
    });
    return response;
  }

  // Seul un « /projects » nu — celui du menu — ouvre le dernier projet. Dès
  // qu'un paramètre est présent (un filtre de la liste, ou `liste=1`), la
  // liste s'affiche : sans quoi filtrer la liste renverrait sur un projet.
  if (pathname === "/projects" && ![...search.keys()].length) {
    const last = request.cookies.get(LAST_PROJECT_COOKIE)?.value;
    if (last) {
      const url = request.nextUrl.clone();
      url.pathname = `/projects/${last}`;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
