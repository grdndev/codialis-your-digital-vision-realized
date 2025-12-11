import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import GlobalBackground from "@/components/GlobalBackground";

const PrivatePolicy = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background text-gray-300 relative selection:bg-primary/30 dark">
      <GlobalBackground />
      
      <div className="relative z-10 flex-1">
        <Navbar />
        
        <div className="container mx-auto px-6 py-32">
          <h1 className="text-4xl md:text-5xl font-bold mb-12 text-center text-white">Politique de Confidentialité</h1>
          
          <div className="max-w-4xl mx-auto space-y-12">
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-primary">1. Collecte des données</h2>
              <div className="bg-white/5 p-6 rounded-xl border border-white/10 backdrop-blur-sm">
                <p className="leading-relaxed">
                  Nous collectons les informations que vous nous fournissez directement lorsque vous utilisez notre formulaire de contact :
                </p>
                <ul className="list-disc list-inside mt-4 space-y-2 ml-4">
                  <li>Nom et prénom</li>
                  <li>Adresse email</li>
                  <li>Informations relatives à votre projet</li>
                </ul>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-primary">2. Utilisation des données</h2>
              <div className="bg-white/5 p-6 rounded-xl border border-white/10 backdrop-blur-sm">
                <p className="leading-relaxed">
                  Les informations recueillies sont utilisées uniquement pour :
                </p>
                <ul className="list-disc list-inside mt-4 space-y-2 ml-4">
                  <li>Répondre à vos demandes de devis et de contact</li>
                  <li>Vous communiquer des informations sur nos services</li>
                  <li>Améliorer notre communication et nos services</li>
                </ul>
                <p className="mt-4">
                  Vos données ne sont jamais vendues, louées ou partagées à des tiers à des fins commerciales.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-primary">3. Sécurité des données</h2>
              <div className="bg-white/5 p-6 rounded-xl border border-white/10 backdrop-blur-sm">
                <p className="leading-relaxed">
                  Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles appropriées pour protéger vos données personnelles contre l'accès non autorisé, la modification, la divulgation ou la destruction.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-primary">4. Vos droits</h2>
              <div className="bg-white/5 p-6 rounded-xl border border-white/10 backdrop-blur-sm">
                <p className="leading-relaxed">
                  Conformément au RGPD, vous disposez des droits suivants concernant vos données personnelles :
                </p>
                <ul className="list-disc list-inside mt-4 space-y-2 ml-4">
                  <li>Droit d'accès et de rectification</li>
                  <li>Droit à l'effacement ("droit à l'oubli")</li>
                  <li>Droit à la limitation du traitement</li>
                  <li>Droit à la portabilité des données</li>
                </ul>
                <p className="mt-4">
                  Pour exercer ces droits, contactez-nous à : <a href="mailto:contact@codialis.com" className="text-primary hover:underline">contact@codialis.com</a>
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-primary">5. Cookies</h2>
              <div className="bg-white/5 p-6 rounded-xl border border-white/10 backdrop-blur-sm">
                <p className="leading-relaxed">
                  Ce site n'utilise pas de cookies de traçage publicitaire. Seuls des cookies techniques essentiels au bon fonctionnement du site peuvent être déposés.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

const PrivatePolicyPage = () => {
    return (
      <PrivatePolicy />
    )
  }

export default PrivatePolicyPage;
