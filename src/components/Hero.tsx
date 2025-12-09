import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar } from "lucide-react";
import heroBackground from "@/assets/hero-background.jpg";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-hero">
      <div
        className="absolute inset-0 z-0 opacity-10"
        style={{
          backgroundImage: `url(${heroBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      <div className="container mx-auto px-6 py-16 relative z-10">
        <div className="max-w-4xl space-y-8 animate-fade-in">
          <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-tight text-left">
            Développement sur mesure.
            <span className="block text-primary mt-2">Résultats concrets.</span>
          </h1>

          <p className="text-base md:text-lg text-muted-foreground max-w-2xl text-left mt-4">
            Apps, SaaS, CRM/ERP, IA, Jeux & Réalité Mixte
          </p>

          <p className="text-base md:text-lg font-semibold text-muted-foreground max-w-3xl text-left leading-relaxed mt-8">
            Codialis est votre partenaire de confiance pour la conception et le
            développement de solutions digitales sur-mesure. Nous transformons
            vos défis métiers en atouts compétitifs grâce à des applications
            mobiles performantes, des logiciels robustes et des systèmes CRM/ERP
            entièrement adaptés à vos processus. <br />
            <br />
            Notre mission ? Vous fournir une technologie qui n'est pas seulement
            fonctionnelle, mais qui devient un véritable levier pour accélérer
            votre croissance, fidéliser vos clients et optimiser votre
            productivité. <br />
            <br />
            Notre Expertise : Développement d'Applications Mobiles (iOS &
            Android) & Web (Saas), Conception de Logiciels Sur-Mesure,
            Intégration et Développement de CRM/ERP, Conseil en Digitalisation
          </p>

          <div className="flex flex-col sm:flex-row gap-3 items-start pt-8">
            <Button
              variant="hero"
              size="lg"
              className="group"
              onClick={() =>
                document
                  .getElementById("contact")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Demander un devis
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>

            <Button
              variant="heroSecondary"
              size="lg"
              className="group"
              onClick={() =>
                window.open(
                  "https://calendly.com/grdndevelopment/consulting",
                  "_blank"
                )
              }
            >
              <Calendar className="mr-2 h-4 w-4" />
              Prendre rendez-vous
            </Button>
          </div>

          <div className="pt-6 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl">
            {[
              { value: "50+", label: "Projets livrés" },
              { value: "98%", label: "Satisfaction client" },
              { value: "7+", label: "Années d'expertise" },
              { value: "24h", label: "Temps de réponse" },
            ].map((stat, index) => (
              <div key={index} className="text-left">
                <div className="text-2xl md:text-3xl font-bold text-primary">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default Hero;
