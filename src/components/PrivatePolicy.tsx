const PrivatePolicy = () => {
  return (
    <div className="container mx-auto px-6 py-16 max-w-4xl text-muted-foreground">
      <h1 className="text-3xl font-bold text-foreground mb-6">
        POLITIQUE DE CONFIDENTIALITÉ – RGPD
      </h1>

      <p className="mb-4 leading-relaxed">
        CODIALIS s’engage à respecter la réglementation relative à la protection
        des données personnelles, notamment :
      </p>

      <ul className="list-disc pl-5 space-y-2 mb-8">
        <li>
          <span className="font-semibold text-foreground">Règlement (UE) 2016/679 (RGPD)</span>
        </li>
        <li>
          <span className="font-semibold text-foreground">
            Loi Informatique et Libertés du 6 janvier 1978
          </span>
          , modifiée
        </li>
      </ul>

      {/* 1. Données collectées */}
      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">1. Données collectées</h2>
        <p className="mb-3 leading-relaxed">
          Dans le cadre de l’utilisation du site ou lors de la prise de contact,
          CODIALIS peut collecter les données suivantes :
        </p>
        <ul className="list-disc pl-5 space-y-2 mb-4">
          <li>
            <span className="font-semibold text-foreground">Nom, prénom</span>
          </li>
          <li>
            <span className="font-semibold text-foreground">Adresse e-mail</span>
          </li>
          <li>
            <span className="font-semibold text-foreground">Téléphone</span>
          </li>
          <li>
            <span className="font-semibold text-foreground">Société / Fonction</span>
          </li>
          <li>
            <span className="font-semibold text-foreground">
              Adresses IP, logs techniques (sécurité du site)
            </span>
          </li>
        </ul>
        <p className="leading-relaxed">CODIALIS ne collecte aucune donnée sensible sans consentement explicite.</p>
      </section>

      {/* 2. Finalités du traitement */}
      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">2. Finalités du traitement</h2>
        <p className="mb-4 leading-relaxed">Les données collectées sont utilisées pour :</p>

        <div className="overflow-x-auto">
          <table className="w-full border border-border text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="border border-border px-3 py-2 text-left">Finalité</th>
                <th className="border border-border px-3 py-2 text-left">Base légale</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-border px-3 py-2">Réponse aux demandes / contact</td>
                <td className="border border-border px-3 py-2">Intérêt légitime</td>
              </tr>
              <tr>
                <td className="border border-border px-3 py-2">Élaboration de devis &amp; contrats</td>
                <td className="border border-border px-3 py-2">Exécution contractuelle</td>
              </tr>
              <tr>
                <td className="border border-border px-3 py-2">Maintenance et sécurité du site</td>
                <td className="border border-border px-3 py-2">Intérêt légitime</td>
              </tr>
              <tr>
                <td className="border border-border px-3 py-2">Prospection commerciale (si consentement)</td>
                <td className="border border-border px-3 py-2">Consentement</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Durée de conservation */}
      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">3. Durée de conservation</h2>

        <div className="overflow-x-auto">
          <table className="w-full border border-border text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="border border-border px-3 py-2 text-left">Type de données</th>
                <th className="border border-border px-3 py-2 text-left">Durée</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-border px-3 py-2">Données de contact</td>
                <td className="border border-border px-3 py-2">3 ans après dernier échange</td>
              </tr>
              <tr>
                <td className="border border-border px-3 py-2">Données contractuelles/facturation</td>
                <td className="border border-border px-3 py-2">10 ans (obligation légale)</td>
              </tr>
              <tr>
                <td className="border border-border px-3 py-2">Logs de connexion</td>
                <td className="border border-border px-3 py-2">12 mois maximum</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Destinataires des données */}
      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">4. Destinataires des données</h2>
        <p className="mb-3 leading-relaxed">
          Les données sont destinées uniquement à <span className="font-semibold text-foreground">CODIALIS</span> et ne sont <span className="font-semibold text-foreground">jamais vendues</span>.
        </p>
        <p className="leading-relaxed">
          Elles peuvent être transmises à des sous-traitants (hébergeurs, prestataires
          cloud) <span className="font-semibold text-foreground">uniquement dans le cadre de nos services</span>, et dans le respect du RGPD.
        </p>
      </section>

      {/* 5. Cookies */}
      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">5. Cookies</h2>
        <p className="mb-3 leading-relaxed">Le site peut utiliser des cookies :</p>
        <ul className="list-disc pl-5 space-y-2 mb-3">
          <li>techniques (fonctionnement du site),</li>
          <li>statistiques (audience),</li>
          <li>marketing (uniquement avec consentement).</li>
        </ul>
        <p className="leading-relaxed">Un bandeau de consentement (type CMP) doit permettre d’accepter/refuser.</p>
      </section>

      {/* 6. Vos droits */}
      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">6. Vos droits</h2>
        <p className="mb-3 leading-relaxed">Conformément au RGPD, vous disposez des droits suivants :</p>
        <ul className="list-disc pl-5 space-y-2 mb-4">
          <li>droit d’accès,</li>
          <li>droit de rectification,</li>
          <li>droit à l’effacement,</li>
          <li>droit d’opposition,</li>
          <li>droit à la limitation du traitement,</li>
          <li>droit à la portabilité.</li>
        </ul>

        <p className="mb-2 leading-relaxed">Pour exercer ces droits :</p>
        <p className="mb-1">
          <a href="mailto:jayan@codialis.com" className="font-semibold text-primary hover:underline">jayan@codialis.com</a>
        </p>
        <p className="mb-1 leading-relaxed">
          Ou courrier au <span className="font-semibold text-foreground">88 Rue du Génie, 94400 Vitry-sur-Seine</span>
        </p>
        <p className="leading-relaxed">
          Vous disposez également d’un droit de réclamation auprès de la{' '}
          <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">CNIL.fr</a>.
        </p>
      </section>

      {/* 7. Sécurité */}
      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">7. Sécurité</h2>
        <p className="mb-3 leading-relaxed">CODIALIS met en place des mesures techniques et organisationnelles renforcées :</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>cryptage SSL/TLS,</li>
          <li>gestion d’accès,</li>
          <li>serveurs sécurisés,</li>
          <li>sauvegardes et redondance cloud,</li>
          <li>journalisation et supervision.</li>
        </ul>
      </section>
    </div>
  );
};

export default PrivatePolicy;
