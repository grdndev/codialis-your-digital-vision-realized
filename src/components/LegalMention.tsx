const LegalMention = () => {
    return (
        <div className="container mx-auto px-6 py-24">
        {/* 1. Informations générales */}
        <section>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                1. Informations générales
            </h2>

            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-4">
            Le site internet{" "}
            <a
                href="https://www.codialis.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary underline"
            >
                www.codialis.com
            </a>{" "}
            est édité par la société :
            </p>

            <h3 className="text-2xl font-bold text-primary">CODIALIS</h3>

            <ul className="space-y-2 text-muted-foreground mt-4">
            <li>
                <span className="block mt-2 font-medium">Forme juridique :</span> EURL (Entreprise Unipersonnelle à Responsabilité
                Limitée)
            </li>
            <li>
                <span className="block mt-2 font-medium">Capital social :</span> 1 000,00 €
            </li>
            <li>
                <span className="block mt-2 font-medium">Siège social :</span> 88 Rue du Génie, 94400 VITRY-SUR-SEINE – France
            </li>
            <li>
                <span className="block mt-2 font-medium">SIREN :</span> 991 679 457
            </li>
            <li>
                <span className="block mt-2 font-medium">SIRET :</span> 991 679 457 00010
            </li>
            <li>
                <span className="block mt-2 font-medium">RCS :</span> 991 679 457 R.C.S. Créteil
            </li>
            <li>
                <span className="block mt-2 font-medium">Numéro de TVA intracommunautaire :</span> FR77991679457
            </li>
            <li>
                <span className="block mt-2 font-medium">Activité :</span> Conseil en systèmes et logiciels informatiques (NAF
                62.02A)
            </li>
            <li>
                <span className="block mt-2 font-medium">Dirigeant et responsable de la publication :</span> M. Jayan GRONDIN
            </li>
            <li>
                <span className="block mt-2 font-medium">Téléphone :</span> <span className="text-muted-foreground">06 93 29 84 20</span>
            </li>
            <li>
                <span className="block mt-2 font-medium">E-mail :</span>{" "}
                <a href="mailto:jayan@codialis.com" className="text-primary hover:underline">
                jayan@codialis.com
                </a>
            </li>
            </ul>
        </section>

        {/* 2. Hébergement */}
        <section className="mt-12">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">2. Hébergement</h2>
            <p className="italic mb-2 text-muted-foreground">
            (à compléter si vous utilisez OVH / AWS / Gandi / autre)
            </p>
            <ul className="space-y-1 text-muted-foreground">
            <li>
                <span className="font-semibold">Nom de l’hébergeur :</span> …
            </li>
            <li>
                <span className="font-semibold">Adresse :</span> …
            </li>
            <li>
                <span className="font-semibold">Site web :</span> …
            </li>
            </ul>
        </section>

        {/* 3. Propriété intellectuelle */}
        <section className="mt-12">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">3. Propriété intellectuelle</h2>
            <p className="mb-2 text-muted-foreground">
            Le site ainsi que l’ensemble des éléments le composant (textes, logos, images, vidéos, code source, bases de
            données, logiciels, etc.) sont la propriété exclusive de <span className="font-semibold text-primary">CODIALIS</span>,
            sauf mention contraire.
            </p>
            <p className="text-muted-foreground">
            Toute reproduction, utilisation ou modification sans autorisation est interdite conformément au Code de la
            propriété intellectuelle.
            </p>
        </section>

        {/* 4. Services proposés */}
        <section className="mt-12">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">4. Services proposés</h2>
            <p className="mb-2 text-muted-foreground">CODIALIS propose des prestations de :</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>
                Développement de solutions <span className="font-semibold text-primary">ERP / CRM sur mesure</span>
            </li>
            <li>
                Développement <span className="font-semibold text-primary">applications web et mobiles</span>
            </li>
            <li>
                Conception de <span className="font-semibold text-primary">logiciels d’entreprise et SaaS</span>
            </li>
            <li>
                <span className="font-semibold text-primary">Solutions cloud</span> (migration, infrastructure, supervision)
            </li>
            <li>
                <span className="font-semibold text-primary">Chatbots &amp; assistants virtuels IA</span>
            </li>
            </ul>
            <p className="mt-2 text-muted-foreground">
            Ces services peuvent faire l’objet de contrats et conditions spécifiques communiqués lors de la commande.
            </p>
        </section>

        {/* 5. Limitation de responsabilité */}
        <section className="mt-12">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">5. Limitation de responsabilité</h2>
            <p className="mb-2 text-muted-foreground">
            CODIALIS met tout en œuvre pour garantir l’exactitude et la mise à jour des informations.
            </p>
            <p className="text-muted-foreground">Elle ne saurait cependant être tenue responsable en cas :</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-muted-foreground">
            <li>d’erreurs techniques, typographiques ou inexactitudes,</li>
            <li>d’interruption du site,</li>
            <li>ou de dommages directs/indirects liés à l’utilisation du site.</li>
            </ul>
        </section>

        {/* 6. Liens externes */}
        <section className="mt-12">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">6. Liens externes</h2>
            <p className="text-muted-foreground">
            La société ne peut être tenue responsable du contenu des sites tiers accessibles via liens hypertextes.
            </p>
        </section>
        </div>

    )
}

export default LegalMention;