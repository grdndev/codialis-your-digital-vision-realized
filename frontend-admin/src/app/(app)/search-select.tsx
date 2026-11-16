"use client";

import { useEffect, useId, useRef, useState } from "react";
import { foldText } from "@/lib/format";

export type SearchOption = { value: string; label: string };

// Liste déroulante dans laquelle on tape pour chercher (CC-377) : un `<select>`
// natif ne se filtre pas, et la liste des clients s'allonge à chaque affaire
// signée. Le champ visible ne porte pas de `name` : c'est un champ caché qui
// envoie l'identifiant choisi, sous le même nom que l'ancien `<select>`, et
// l'action serveur ne voit aucune différence.
//
// Rien n'est présélectionné : le `<select>` proposait d'office le premier
// client de la liste, et un projet créé sans regarder ce champ partait chez
// lui (même piège que les catégories de CC-368, rangées dans ADD).
export function SearchSelect({
  name,
  options,
  required = false,
  disabled = false,
  placeholder = "Rechercher…",
  emptyText = "Aucun résultat.",
  requiredMessage = "Choisissez une valeur dans la liste.",
}: {
  name: string;
  options: SearchOption[];
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  emptyText?: string;
  requiredMessage?: string;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // Faux tant qu'on n'a rien tapé depuis l'ouverture : la liste s'affiche alors
  // en entier, et non filtrée par le libellé déjà choisi.
  const [typed, setTyped] = useState(false);
  const [active, setActive] = useState(0);

  const selectedLabel = options.find((o) => o.value === selected)?.label ?? "";
  const needle = typed ? foldText(query.trim()) : "";
  const matches = needle ? options.filter((o) => foldText(o.label).includes(needle)) : options;

  // Un champ caché n'est pas contrôlé par le navigateur : c'est le champ
  // visible qui porte le refus, avec un message qui dit quoi faire.
  useEffect(() => {
    inputRef.current?.setCustomValidity(required && !selected ? requiredMessage : "");
  }, [required, selected, requiredMessage]);

  // React vide le formulaire après une action réussie par un `reset`, qui ne
  // touche pas à l'état d'un composant (TRAP-030) : on s'y abonne.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () => {
      setSelected("");
      setQuery("");
      setTyped(false);
      setOpen(false);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  // La ligne active reste visible quand on la déplace au clavier.
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function openList() {
    setQuery(selectedLabel);
    setTyped(false);
    setActive(Math.max(0, options.findIndex((o) => o.value === selected)));
    setOpen(true);
  }

  function choose(option: SearchOption) {
    setSelected(option.value);
    setQuery(option.label);
    setTyped(false);
    setOpen(false);
  }

  // Quitter le champ sans choisir rend le libellé déjà choisi : le texte tapé
  // ne vaut pas choix, sinon on croirait avoir désigné un client qu'on n'a fait
  // que chercher.
  function close() {
    setQuery(selectedLabel);
    setTyped(false);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return openList();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((i) => Math.min(Math.max(i + step, 0), Math.max(matches.length - 1, 0)));
    } else if (event.key === "Enter") {
      // Liste ouverte, Entrée choisit la ligne : elle n'envoie pas le formulaire.
      if (!open) return;
      event.preventDefault();
      if (matches[active]) choose(matches[active]);
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        close();
      }
    }
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={selected} />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        value={open ? query : selectedLabel}
        onFocus={openList}
        onClick={() => {
          if (!open) openList();
        }}
        onBlur={close}
        onChange={(event) => {
          setQuery(event.target.value);
          setTyped(true);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className="input"
      />
      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-panel py-1 shadow-lg"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">{emptyText}</li>
          ) : (
            matches.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.value === selected}
                // mousedown et non click : le champ perdrait le focus avant le
                // clic, et la liste se refermerait sous le pointeur.
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(o);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  i === active ? "bg-panel-2 text-text" : "text-muted"
                } ${o.value === selected ? "font-medium text-mint" : ""}`}
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
