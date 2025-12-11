import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Bot, Calendar, Cloud as CloudIcon, Heart, Car } from "lucide-react";
import { useEffect, useState, useRef } from "react";

const projects = [
  {
    icon: ShoppingCart,
    title: "Application e-commerce billets",
    description: "Plateforme complète de vente de billets avec intégration Stripe",
    tags: ["Stripe", "E-commerce", "React"],
  },
  {
    icon: Bot,
    title: "SaaS IA pour e-commerce",
    description: "Solution d'intelligence artificielle pour optimiser les ventes en ligne",
    tags: ["IA", "SaaS", "Next.js"],
  },
  {
    icon: Calendar,
    title: "App IA de planification intelligente",
    description: "Assistant intelligent pour la gestion du temps et des tâches",
    tags: ["IA", "Productivité", "Mobile"],
  },
  {
    icon: CloudIcon,
    title: "Déploiement Cloud souverain",
    description: "Infrastructure cloud sécurisée et conforme aux normes européennes",
    tags: ["Cloud", "DevOps", "Sécurité"],
  },
  {
    icon: Heart,
    title: "MVP santé & bien-être",
    description: "Application innovante dans le domaine de la santé digitale",
    tags: ["Santé", "MVP", "Mobile"],
  },
  {
    icon: Car,
    title: "Application location voiture",
    description: "Plateforme de location de véhicules avec géolocalisation",
    tags: ["Location", "Maps", "React Native"],
  },
];

const Portfolio = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section 
      ref={sectionRef}
      id="realisations" 
      className="relative py-24 overflow-hidden text-white"
    >
      {/* Removed local background glows */}

      <div className="container mx-auto px-6 relative z-10">
        {/* Header */}
        <div className={`text-center mb-16 space-y-4 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
            Réalisations
          </h2>
          <p className="text-lg md:text-xl text-[#F69292]/70 max-w-2xl mx-auto">
            Projets ambitieux, résultats mesurables
          </p>
        </div>
        
        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project, index) => (
            <Card 
              key={index}
              className={`group bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 hover:border-primary/30 transition-all duration-500 hover:-translate-y-2 cursor-pointer ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{ 
                transitionDelay: `${300 + index * 100}ms`,
                boxShadow: hoveredIndex === index ? '0 0 40px rgba(246, 146, 146, 0.3)' : 'none'
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:bg-primary/40 group-hover:rotate-6">
                    <project.icon className="h-7 w-7 text-primary transition-colors group-hover:text-white" />
                  </div>
                </div>
                <CardTitle className="text-lg leading-tight text-white group-hover:text-primary transition-colors">
                  {project.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <CardDescription className="text-sm text-[#F69292]/70">
                  {project.description}
                </CardDescription>
                <div className="flex flex-wrap gap-2">
                  {project.tags.map((tag, tagIndex) => (
                    <Badge 
                      key={tagIndex} 
                      className="text-xs bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Decorative animated line */}
        <div className={`mt-16 flex justify-center transition-all duration-1000 delay-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="h-px w-32 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-20px) translateX(10px); }
          50% { transform: translateY(-10px) translateX(-10px); }
          75% { transform: translateY(-25px) translateX(5px); }
        }
      `}</style>
    </section>
  );
};

export default Portfolio;
