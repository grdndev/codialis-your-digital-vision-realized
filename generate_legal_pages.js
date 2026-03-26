const fs = require('fs');
const index = fs.readFileSync('index.html', 'utf8');

const heroMarker = '<!-- ═══════════════════════════════════════\r\n         HERO';
const heroMarker2 = '<!-- ═══════════════════════════════════════\n         HERO';

let heroIndex = index.indexOf(heroMarker);
if (heroIndex === -1) heroIndex = index.indexOf(heroMarker2);

const footerMarker = '<!-- ═══════════════════════════════════════\r\n         FOOTER';
const footerMarker2 = '<!-- ═══════════════════════════════════════\n         FOOTER';

let footerIndex = index.indexOf(footerMarker);
if (footerIndex === -1) footerIndex = index.indexOf(footerMarker2);

const headAndNav = index.substring(0, heroIndex);
const footerAndScripts = index.substring(footerIndex);

let modifiedHeadNav = headAndNav.replace(/href="#([a-zA-Z0-9_-]+)"/g, 'href="index.html#$1"');
modifiedHeadNav = modifiedHeadNav.replace(/href="index.html#hero"/g, 'href="index.html"');

let modifiedHeadNavMentions = modifiedHeadNav.replace(
  '<title>Codialis — Agence Technologique Premium | SaaS · Mobile · IA · CRM · VR/AR</title>',
  '<title>Mentions Légales | Codialis</title>'
);

let modifiedHeadNavPrivacy = modifiedHeadNav.replace(
  '<title>Codialis — Agence Technologique Premium | SaaS · Mobile · IA · CRM · VR/AR</title>',
  '<title>Politique de Confidentialité | Codialis</title>'
);

const customContentMentions = [
  '<section id="legal-page" style="padding-top: 120px; padding-bottom: 80px;">',
  '  <div class="container">',
  '    <div class="section-header centered">',
  '      <h1 class="hero-h1" style="font-size: clamp(2rem, 4vw, 3rem);">Mentions <span class="gradient-text">Légales</span></h1>',
  '    </div>',
  '    <div class="glass-card" style="padding: 3rem; max-width: 900px; margin: 0 auto;">',
  '      <div style="color: var(--gray-light); line-height: 1.8;">',
  '        <p style="margin-bottom: 2rem;">Conformément aux dispositions de la loi n° 2004-575 du 21 juin 2004 pour la Confiance en l\'économie numérique (LCEN).</p>',
  '        ',
  '        <h2 style="color: var(--white); font-family: \'Orbitron\', sans-serif; font-size: 1.2rem; margin-top: 2rem; margin-bottom: 1rem;">1. Informations générales</h2>',
  '        <p style="margin-bottom: 1rem;">Le site internet www.codialis.com est édité par la société :<br>',
  '        <strong>CODIALIS</strong><br>',
  '        Forme juridique : EURL (Entreprise Unipersonnelle à Responsabilité Limitée)<br>',
  '        Capital social : 1 000,00 €<br>',
  '        Siège social : 88 Rue du Génie, 94400 VITRY-SUR-SEINE France<br>',
  '        SIREN : 991 679 457 SIRET : 991 679 457 00010<br>',
  '        RCS : 991 679 457 R.C.S. Créteil<br>',
  '        N° TVA intracommunautaire : FR77991679457<br>',
  '        Code NAF / Activité : 62.02A - Conseil en systèmes et logiciels informatiques<br>',
  '        Directeur de la publication : M. Jayan GRONDIN<br>',
  '        Téléphone : 07 83 90 57 17<br>',
  '        E-mail : <a href="mailto:contact@codialis.com" style="color: var(--blue); text-decoration: none;">contact@codialis.com</a></p>',
  '',
  '        <h2 style="color: var(--white); font-family: \'Orbitron\', sans-serif; font-size: 1.2rem; margin-top: 2rem; margin-bottom: 1rem;">2. Hébergement</h2>',
  '        <p style="margin-bottom: 1rem;">Le site www.codialis.com est hébergé par :<br>',
  '        Nom de l\'hébergeur : Hostinger International Ltd.<br>',
  '        Adresse : Švitrigailos g. 34, LT-03230 Vilnius, Lituanie<br>',
  '        Site web : <a href="https://www.hostinger.fr" target="_blank" style="color: var(--blue); text-decoration: none;">www.hostinger.fr</a></p>',
  '',
  '        <h2 style="color: var(--white); font-family: \'Orbitron\', sans-serif; font-size: 1.2rem; margin-top: 2rem; margin-bottom: 1rem;">3. Propriété intellectuelle</h2>',
  '        <p style="margin-bottom: 1rem;">L\'ensemble du contenu du site www.codialis.com — incluant, sans s\'y limiter, les textes, articles, visuels, logos, icônes, photographies, vidéos, interfaces, code source, bases de données et logiciels — est la propriété exclusive de CODIALIS, sauf mention contraire explicite.</p>',
  '        <p style="margin-bottom: 1rem;">Ces éléments sont protégés par le droit français et international de la propriété intellectuelle, notamment le Code de la propriété intellectuelle (articles L.111-1 et suivants).</p>',
  '        <p style="margin-bottom: 1rem;">Toute reproduction, représentation, modification, publication, adaptation ou exploitation, totale ou partielle, par quelque procédé que ce soit, sans l\'autorisation préalable et écrite de CODIALIS, est strictement interdite et constituerait une contrefaçon sanctionnée pénalement et civilement.</p>',
  '',
  '        <h2 style="color: var(--white); font-family: \'Orbitron\', sans-serif; font-size: 1.2rem; margin-top: 2rem; margin-bottom: 1rem;">4. Services proposés</h2>',
  '        <p style="margin-bottom: 1rem;">CODIALIS est une société de conseil et d\'ingénierie informatique spécialisée dans la conception de solutions digitales sur mesure à destination des entreprises. Elle propose notamment : le développement de solutions ERP/CRM sur mesure, le développement d\'applications web et mobiles, la conception de logiciels d\'entreprise et de plateformes SaaS, des solutions cloud (migration, infrastructure, supervision), ainsi que des chatbots et assistants virtuels basés sur l\'intelligence artificielle.</p>',
  '        <p style="margin-bottom: 1rem;">Les informations présentées sur ce site ont un caractère purement indicatif. Toute prestation fait l\'objet d\'un contrat et de conditions particulières communiqués au client lors de la prise en charge de sa demande.</p>',
  '',
  '        <h2 style="color: var(--white); font-family: \'Orbitron\', sans-serif; font-size: 1.2rem; margin-top: 2rem; margin-bottom: 1rem;">5. Limitation de responsabilité</h2>',
  '        <p style="margin-bottom: 1rem;">CODIALIS s\'efforce de maintenir les informations publiées sur ce site aussi exactes et à jour que possible. Toutefois, la société ne saurait être tenue responsable des erreurs ou omissions, d\'une interruption ou indisponibilité du site, de dommages directs ou indirects résultant de l\'accès ou de l\'utilisation du site, ni de l\'utilisation frauduleuse par un tiers des informations transmises via le site.</p>',
  '        <p style="margin-bottom: 1rem;">CODIALIS se réserve le droit de modifier, corriger ou mettre à jour le contenu du site à tout moment et sans préavis.</p>',
  '',
  '        <h2 style="color: var(--white); font-family: \'Orbitron\', sans-serif; font-size: 1.2rem; margin-top: 2rem; margin-bottom: 1rem;">6. Liens hypertextes</h2>',
  '        <p style="margin-bottom: 1rem;">Le site www.codialis.com peut contenir des liens vers des sites tiers. CODIALIS n\'exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu, leur disponibilité ou leur politique de confidentialité.</p>',
  '        <p style="margin-bottom: 1rem;">La création de liens hypertextes pointant vers le site www.codialis.com est soumise à l\'accord préalable et écrit de CODIALIS.</p>',
  '',
  '        <h2 style="color: var(--white); font-family: \'Orbitron\', sans-serif; font-size: 1.2rem; margin-top: 2rem; margin-bottom: 1rem;">7. Données personnelles</h2>',
  '        <p style="margin-bottom: 1rem;">Dans le cadre de l\'utilisation du site, CODIALIS est susceptible de collecter des données à caractère personnel (nom, prénom, adresse e-mail, numéro de téléphone) via les formulaires de contact.</p>',
  '        <p style="margin-bottom: 1rem;">Ces données sont traitées conformément au Règlement Général sur la Protection des Données (RGPD – Règlement UE 2016/679) et à la loi Informatique et Libertés n° 78-17 du 6 janvier 1978 modifiée.</p>',
  '        <p style="margin-bottom: 1rem;">Elles sont destinées exclusivement à CODIALIS, ne sont pas transmises à des tiers, et sont conservées pour la durée strictement nécessaire à leur finalité.</p>',
  '        <p style="margin-bottom: 1rem;">Conformément à la réglementation en vigueur, vous disposez d\'un droit d\'accès, de rectification, d\'opposition, d\'effacement et de portabilité de vos données, que vous pouvez exercer en contactant : <a href="mailto:contact@codialis.com" style="color: var(--blue); text-decoration: none;">contact@codialis.com</a></p>',
  '        <p style="margin-bottom: 1rem;">Pour toute réclamation, vous pouvez également saisir la Commission Nationale de l\'Informatique et des Libertés (CNIL) — www.cnil.fr.</p>',
  '',
  '        <h2 style="color: var(--white); font-family: \'Orbitron\', sans-serif; font-size: 1.2rem; margin-top: 2rem; margin-bottom: 1rem;">8. Cookies</h2>',
  '        <p style="margin-bottom: 1rem;">Le site www.codialis.com est susceptible d\'utiliser des cookies à des fins de mesure d\'audience, d\'amélioration de l\'expérience utilisateur ou de mémorisation de préférences de navigation.</p>',
  '        <p style="margin-bottom: 1rem;">Conformément à la réglementation applicable, votre consentement est recueilli avant le dépôt de tout cookie non strictement nécessaire au fonctionnement du site. Vous pouvez à tout moment modifier vos préférences directement depuis les paramètres de votre navigateur.</p>',
  '',
  '        <h2 style="color: var(--white); font-family: \'Orbitron\', sans-serif; font-size: 1.2rem; margin-top: 2rem; margin-bottom: 1rem;">9. Droit applicable et juridiction compétente</h2>',
  '        <p style="margin-bottom: 1rem;">Les présentes mentions légales sont régies par le droit français. En cas de litige relatif à l\'interprétation ou à l\'exécution des présentes, et à défaut de résolution amiable, les tribunaux compétents du ressort de Créteil seront seuls compétents.</p>',
  '      </div>',
  '    </div>',
  '  </div>',
  '</section>'
].join('\n');

const customContentPrivacy = [
  '<section id="legal-page" style="padding-top: 120px; padding-bottom: 80px;">',
  '  <div class="container">',
  '    <div class="section-header centered">',
  '      <h1 class="hero-h1" style="font-size: clamp(2rem, 4vw, 3rem);">Politique de <span class="gradient-text">Confidentialité</span></h1>',
  '    </div>',
  '    <div class="glass-card" style="padding: 3rem; max-width: 900px; margin: 0 auto;">',
  '      <div style="color: var(--gray-light); line-height: 1.8;">',
  '        <p style="margin-bottom: 2rem; font-style: italic;">Dernière mise à jour : mars 2025</p>',
  '        <p style="margin-bottom: 2rem;">Conformément au Règlement Général sur la Protection des Données (RGPD – Règlement UE 2016/679) et à la loi Informatique et Libertés n° 78-17 du 6 janvier 1978 modifiée.</p>',
  '        ',
  '        <h2 style="color: var(--white); font-family: \'Orbitron\', sans-serif; font-size: 1.2rem; margin-top: 2rem; margin-bottom: 1rem;">1. Identité du responsable de traitement</h2>',
  '        <p style="margin-bottom: 1rem;">Le responsable du traitement des données personnelles collectées sur le site www.codialis.com est :<br>',
  '        <strong>Société :</strong> CODIALIS<br>',
  '        <strong>Représentant légal :</strong> M. Jayan GRONDIN<br>',
  '        <strong>Adresse :</strong> 88 Rue du Génie, 94400 VITRY-SUR-SEINE France<br>',
  '        <strong>E-mail :</strong> <a href="mailto:jayan@codialis.com" style="color: var(--blue); text-decoration: none;">jayan@codialis.com</a><br>',
  '        <strong>Téléphone :</strong> 06 93 29 84 20</p>',
  '',
  '        <h2 style="color: var(--white); font-family: \'Orbitron\', sans-serif; font-size: 1.2rem; margin-top: 2rem; margin-bottom: 1rem;">2. Données collectées</h2>',
  '        <p style="margin-bottom: 1rem;">Dans le cadre de l\'utilisation du site www.codialis.com, CODIALIS est susceptible de collecter les données personnelles suivantes :</p>',
  '        <ul style="margin-bottom: 1rem; margin-left: 1.5rem;">',
  '          <li><strong>Via le formulaire de contact :</strong> nom, prénom, adresse e-mail, numéro de téléphone, nom de l\'entreprise et le contenu du message transmis.</li>',
  '          <li><strong>Automatiquement lors de la navigation :</strong> adresse IP, type et version du navigateur, pages visitées, durée de la visite, système d\'exploitation, données de cookies (voir section 7).</li>',
  '        </ul>',
  '        <p style="margin-bottom: 1rem;">Ces données sont collectées uniquement lorsque vous les communiquez volontairement ou lors de votre navigation sur le site.</p>',
  '',
  '        <h2 style="color: var(--white); font-family: \'Orbitron\', sans-serif; font-size: 1.2rem; margin-top: 2rem; margin-bottom: 1rem;">3. Finalités du traitement</h2>',
  '        <p style="margin-bottom: 1rem;">Les données collectées sont utilisées exclusivement aux fins suivantes : répondre à vos demandes de contact ou de devis, assurer le suivi commercial et la relation client, améliorer l\'expérience de navigation sur le site, mesurer l\'audience du site à des fins statistiques, et respecter les obligations légales et réglementaires applicables à CODIALIS.</p>',
  '        <p style="margin-bottom: 1rem;">Aucune donnée n\'est utilisée à des fins de prospection commerciale sans votre consentement préalable.</p>',
  '',
  '        <h2 style="color: var(--white); font-family: \'Orbitron\', sans-serif; font-size: 1.2rem; margin-top: 2rem; margin-bottom: 1rem;">4. Base légale des traitements</h2>',
  '        <p style="margin-bottom: 1rem;">Chaque traitement repose sur l\'une des bases légales suivantes prévues par le RGPD : votre consentement (article 6.1.a), l\'exécution d\'un contrat ou de mesures précontractuelles à votre demande (article 6.1.b), le respect d\'une obligation légale à laquelle CODIALIS est soumise (article 6.1.c), ou l\'intérêt légitime de CODIALIS à développer et améliorer ses services (article 6.1.f).</p>',
  '',
  '        <h2 style="color: var(--white); font-family: \'Orbitron\', sans-serif; font-size: 1.2rem; margin-top: 2rem; margin-bottom: 1rem;">5. Destinataires des données</h2>',
  '        <p style="margin-bottom: 1rem;">Les données personnelles collectées sont destinées exclusivement à CODIALIS et à ses collaborateurs habilités, dans la stricte limite de leurs attributions.</p>',
  '        <p style="margin-bottom: 1rem;">CODIALIS ne vend, ne loue et ne cède aucune donnée personnelle à des tiers à des fins commerciales.</p>',
  '        <p style="margin-bottom: 1rem;">Des données peuvent toutefois être transmises à des prestataires techniques tiers agissant en qualité de sous-traitants (hébergement, outil d\'envoi d\'e-mails, analytics), liés par des engagements contractuels conformes au RGPD. Ces prestataires n\'utilisent vos données qu\'aux seules fins nécessaires à l\'exécution de leur mission.</p>',
  '        <p style="margin-bottom: 1rem;">En cas d\'obligation légale ou judiciaire, CODIALIS peut être amenée à communiquer certaines données aux autorités compétentes.</p>',
  '',
  '        <h2 style="color: var(--white); font-family: \'Orbitron\', sans-serif; font-size: 1.2rem; margin-top: 2rem; margin-bottom: 1rem;">6. Durée de conservation</h2>',
  '        <p style="margin-bottom: 1rem;">Les données sont conservées pendant la durée strictement nécessaire aux finalités pour lesquelles elles ont été collectées, soit : 3 ans à compter du dernier contact pour les données de prospects et clients, 5 ans pour les données liées à une relation contractuelle (conformément aux obligations légales comptables et fiscales), et 13 mois maximum pour les données de cookies et de navigation.</p>',
  '        <p style="margin-bottom: 1rem;">À l\'issue de ces délais, les données sont supprimées ou anonymisées de façon irréversible.</p>',
  '',
  '        <h2 style="color: var(--white); font-family: \'Orbitron\', sans-serif; font-size: 1.2rem; margin-top: 2rem; margin-bottom: 1rem;">7. Cookies</h2>',
  '        <p style="margin-bottom: 1rem;">Un cookie est un petit fichier texte déposé sur votre terminal (ordinateur, tablette, smartphone) lors de la visite d\'un site internet.</p>',
  '        <p style="margin-bottom: 1rem;">Le site www.codialis.com peut utiliser les types de cookies suivants : les cookies strictement nécessaires au fonctionnement du site (navigation, sécurité), qui ne nécessitent pas de consentement ; les cookies de mesure d\'audience (statistiques de fréquentation anonymisées) ; et les cookies de préférences permettant de mémoriser vos choix de navigation.</p>',
  '        <p style="margin-bottom: 1rem;">Lors de votre première visite, un bandeau vous informe de la présence de cookies et vous permet d\'accepter ou de refuser les cookies non essentiels. Vous pouvez modifier vos préférences à tout moment depuis les paramètres de votre navigateur ou via le gestionnaire de cookies du site.</p>',
  '        <p style="margin-bottom: 1rem;">La désactivation de certains cookies peut limiter certaines fonctionnalités du site.</p>',
  '',
  '        <h2 style="color: var(--white); font-family: \'Orbitron\', sans-serif; font-size: 1.2rem; margin-top: 2rem; margin-bottom: 1rem;">8. Vos droits</h2>',
  '        <p style="margin-bottom: 1rem;">Conformément au RGPD et à la loi Informatique et Libertés, vous disposez des droits suivants sur vos données personnelles :</p>',
  '        <ul style="margin-bottom: 1rem; margin-left: 1.5rem;">',
  '          <li><strong>Droit d\'accès :</strong> obtenir la confirmation que des données vous concernant sont traitées et en obtenir une copie.</li>',
  '          <li><strong>Droit de rectification :</strong> demander la correction de données inexactes ou incomplètes.</li>',
  '          <li><strong>Droit à l\'effacement :</strong> demander la suppression de vos données dans les cas prévus par la réglementation.</li>',
  '          <li><strong>Droit à la limitation :</strong> demander la suspension temporaire du traitement de vos données.</li>',
  '          <li><strong>Droit d\'opposition :</strong> vous opposer au traitement de vos données fondé sur l\'intérêt légitime ou à des fins de prospection.</li>',
  '          <li><strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré et lisible par machine.</li>',
  '          <li><strong>Droit de retirer votre consentement</strong> à tout moment, sans que cela ne remette en cause la licéité du traitement effectué avant ce retrait.</li>',
  '        </ul>',
  '        <p style="margin-bottom: 1rem;">Pour exercer l\'un de ces droits, vous pouvez contacter CODIALIS par e-mail à l\'adresse suivante : <a href="mailto:contact@codialis.com" style="color: var(--blue); text-decoration: none;">contact@codialis.com</a>, en précisant votre identité et la nature de votre demande. Une réponse vous sera apportée dans un délai maximum d\'un mois à compter de la réception de votre demande.</p>',
  '',
  '        <h2 style="color: var(--white); font-family: \'Orbitron\', sans-serif; font-size: 1.2rem; margin-top: 2rem; margin-bottom: 1rem;">9. Réclamation auprès de la CNIL</h2>',
  '        <p style="margin-bottom: 1rem;">Si vous estimez que le traitement de vos données personnelles ne respecte pas la réglementation en vigueur, vous avez le droit d\'introduire une réclamation auprès de l\'autorité de contrôle compétente :</p>',
  '        <p style="margin-bottom: 1rem;">Commission Nationale de l\'Informatique et des Libertés (CNIL)<br>',
  '        3 Place de Fontenoy – TSA 80715 – 75334 PARIS CEDEX 07<br>',
  '        Site web : <a href="https://www.cnil.fr" target="_blank" style="color: var(--blue); text-decoration: none;">www.cnil.fr</a></p>',
  '',
  '        <h2 style="color: var(--white); font-family: \'Orbitron\', sans-serif; font-size: 1.2rem; margin-top: 2rem; margin-bottom: 1rem;">10. Sécurité des données</h2>',
  '        <p style="margin-bottom: 1rem;">CODIALIS met en œuvre toutes les mesures techniques et organisationnelles appropriées afin de garantir la sécurité, l\'intégrité et la confidentialité de vos données personnelles, et de les protéger contre tout accès non autorisé, toute perte, altération ou divulgation.</p>',
  '        <p style="margin-bottom: 1rem;">En cas de violation de données susceptible d\'engendrer un risque pour vos droits et libertés, CODIALIS s\'engage à en informer la CNIL dans les délais prévus par le RGPD, et le cas échéant, les personnes concernées.</p>',
  '',
  '        <h2 style="color: var(--white); font-family: \'Orbitron\', sans-serif; font-size: 1.2rem; margin-top: 2rem; margin-bottom: 1rem;">11. Transferts de données hors Union européenne</h2>',
  '        <p style="margin-bottom: 1rem;">Les données personnelles collectées sont hébergées au sein de l\'Union européenne, chez Hostinger International Ltd., dont le siège est établi à Vilnius, en Lituanie.</p>',
  '        <p style="margin-bottom: 1rem;">En cas de transfert vers un pays tiers, CODIALIS s\'assure que ce transfert est encadré par des garanties appropriées conformes au RGPD (clauses contractuelles types de la Commission européenne, décision d\'adéquation, etc.).</p>',
  '',
  '        <h2 style="color: var(--white); font-family: \'Orbitron\', sans-serif; font-size: 1.2rem; margin-top: 2rem; margin-bottom: 1rem;">12. Modifications de la présente politique</h2>',
  '        <p style="margin-bottom: 1rem;">CODIALIS se réserve le droit de modifier la présente politique de confidentialité à tout moment, notamment pour se conformer à toute évolution légale, réglementaire ou technique. La date de dernière mise à jour est indiquée en haut du document. Il vous est conseillé de consulter régulièrement cette page.</p>',
  '        <p style="margin-bottom: 1rem;">Pour toute question relative à la protection de vos données personnelles, vous pouvez contacter CODIALIS à l\'adresse : <a href="mailto:contact@codialis.com" style="color: var(--blue); text-decoration: none;">contact@codialis.com</a></p>',
  '      </div>',
  '    </div>',
  '  </div>',
  '</section>'
].join('\n');

fs.writeFileSync('mentions-legales.html', modifiedHeadNavMentions + customContentMentions + footerAndScripts);
console.log('mentions-legales.html created successfully');

fs.writeFileSync('politique-de-confidentialite.html', modifiedHeadNavPrivacy + customContentPrivacy + footerAndScripts);
console.log('politique-de-confidentialite.html created successfully');

// Fix index footer links manually: string split and join
let fixedIndex = index.split('<a href="#" style="color:var(--gray); text-decoration:none; font-size:0.78rem; transition:color 0.2s;" onmouseover="this.style.color=\\'var(--blue) \\'" onmouseout="this.style.color=\\'var(--gray) \\'">Mentions légales</a>').join(
  '<a href="mentions-legales.html" style="color:var(--gray); text-decoration:none; font-size:0.78rem; transition:color 0.2s;" onmouseover="this.style.color=\\'var(--blue) \\'" onmouseout="this.style.color=\\'var(--gray) \\'">Mentions légales</a>'
);
fixedIndex = fixedIndex.split('<a href="#" style="color:var(--gray); text-decoration:none; font-size:0.78rem; transition:color 0.2s;" onmouseover="this.style.color=\\'var(--blue) \\'" onmouseout="this.style.color=\\'var(--gray) \\'">Politique de confidentialité</a>').join(
  '<a href="politique-de-confidentialite.html" style="color:var(--gray); text-decoration:none; font-size:0.78rem; transition:color 0.2s;" onmouseover="this.style.color=\\'var(--blue) \\'" onmouseout="this.style.color=\\'var(--gray) \\'">Politique de confidentialité</a>'
);
fs.writeFileSync('index.html', fixedIndex);
console.log('index.html updated successfully');
