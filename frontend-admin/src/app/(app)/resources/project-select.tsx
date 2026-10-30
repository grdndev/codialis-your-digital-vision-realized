"use client";

// Choix du projet de l'écran Ressources : choisir un projet l'ouvre aussitôt.
// Il fallait cliquer sur « Filtrer », et ce qu'on créait ensuite partait sur
// le projet resté affiché, le premier de la liste (CC-368 : les identifiants
// Brevo de Top formation ont atterri dans ADD).
export function ProjectSelect({
  value,
  options,
}: {
  value: string;
  options: { id: string; label: string }[];
}) {
  return (
    <select
      name="project"
      defaultValue={value}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      className="input h-9 w-64 py-0 text-xs"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
