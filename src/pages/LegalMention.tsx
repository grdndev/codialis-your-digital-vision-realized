import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import Legal_mention from "@/components/LegalMention";
import GlobalBackground from "@/components/GlobalBackground";

const LegalMention = () => {
  return (
    <div className="min-h-screen bg-background relative selection:bg-primary/30 dark">
      <GlobalBackground />
      
      <div className="relative z-10">
        <Navbar />
        
        <div className="container mx-auto px-6 py-32 text-white">
          <h1 className="text-4xl md:text-5xl font-bold mb-12 text-center">Mentions Légales</h1>
          
          <div className="max-w-4xl mx-auto space-y-12">
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-primary">1. Éditeur du site</h2>
              <div className="bg-white/5 p-6 rounded-xl border border-white/10 backdrop-blur-sm">
                <p className="leading-relaxed text-gray-300">
                  Le site Codialis est édité par l'entreprise individuelle <strong>Grondin Jayan</strong>.<br />
                  <strong>Siège social :</strong> 11 allée des jades, 97400 Saint-Denis, La Réunion<br />
                  <strong>SIRET :</strong> 98319838700012<br />
                  <strong>Email :</strong> <a href="mailto:contact@codialis.com" className="text-primary hover:underline">contact@codialis.com</a><br />
                  <strong>Directeur de la publication :</strong> Grondin Jayan
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-primary">2. Hébergement</h2>
              <div className="bg-white/5 p-6 rounded-xl border border-white/10 backdrop-blur-sm">
                <p className="leading-relaxed text-gray-300">
                  Ce site est hébergé par <strong>Vercel Inc.</strong><br />
                  <strong>Adresse :</strong> 340 S Lemon Ave #4133 Walnut, CA 91789, USA<br />
                  <strong>Site web :</strong> <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://vercel.com</a>
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-primary">3. Propriété intellectuelle</h2>
              <div className="bg-white/5 p-6 rounded-xl border border-white/10 backdrop-blur-sm">
                <p className="leading-relaxed text-gray-300">
                  L'ensemble de ce site relève de la législation française et internationale sur le droit d'auteur et la propriété intellectuelle. 
                  Tous les droits de reproduction sont réservés, y compris pour les documents téléchargeables et les représentations iconographiques et photographiques.
                  La reproduction de tout ou partie de ce site sur un support électronique quel qu'il soit est formellement interdite sauf autorisation expresse du directeur de la publication.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-primary">4. Protection des données personnelles</h2>
              <div className="bg-white/5 p-6 rounded-xl border border-white/10 backdrop-blur-sm">
                <p className="leading-relaxed text-gray-300">
                  Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez d'un droit d'accès, de rectification et de suppression des données vous concernant.
                  Pour exercer ce droit, vous pouvez nous contacter à l'adresse : <a href="mailto:contact@codialis.com" className="text-primary hover:underline">contact@codialis.com</a>.
                  Pour plus d'informations, veuillez consulter notre <a href="/privatepolicy" className="text-primary hover:underline">Politique de Confidentialité</a>.
                </p>
              </div>
            </section>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
};

export default LegalMention;
