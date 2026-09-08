import jwt from 'jsonwebtoken';

export const COOKIE_NAME = 'codialis_token';

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, name: user.name, email: user.email, role: user.role, mustChange: !!user.must_change_password },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || '12h' },
  );
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  };
}

// Verifies the JWT from the httpOnly cookie. Attaches req.user.
export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, name: payload.name, email: payload.email, role: payload.role, mustChange: !!payload.mustChange };
    next();
  } catch {
    return res.status(401).json({ error: 'Session invalide ou expirée' });
  }
}

export function requirePatron(req, res, next) {
  if (req.user?.role !== 'patron') return res.status(403).json({ error: 'Réservé à la direction' });
  next();
}

// « Manager » = direction (patron) OU chef de projet. Ces deux rôles partagent
// la même vue d'ensemble (toute l'équipe, tout le contenu). Le chef de projet
// n'a PAS les droits d'écriture réservés au patron (validation des demandes,
// gestion des comptes/soldes) : ceux-là restent derrière requirePatron.
export function isManager(user) {
  return user?.role === 'patron' || user?.role === 'chef';
}

export function requireManager(req, res, next) {
  if (!isManager(req.user)) return res.status(403).json({ error: 'Réservé à la direction et aux chefs de projet' });
  next();
}
