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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
