// Ce qu'une réponse de l'API dit d'un compte qu'elle cite — assigné, auteur,
// responsable, animateur : son identité d'affichage, la forme `UserRef` de
// frontend-admin, et rien d'autre.
//
// Un `include: { assignee: true }` renvoie la ligne `User` ENTIÈRE : hash du
// mot de passe, e-mail, photo en base64, soldes de congés et d'heures. L'API
// étant joignable publiquement, tout compte interne pouvait les lire avec son
// propre jeton (la liste des tickets donnait ceux de toute l'équipe). Chaque
// relation vers un compte passe donc par cette sélection.
export const USER_IDENTITY = {
  select: { id: true, name: true, initials: true, role: true },
} as const;
