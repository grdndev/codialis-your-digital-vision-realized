import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { useEffect, useState, useRef } from "react";

const testimonials = [
  {
    name: "Alan_DA",
    role: "Client - MVP Santé & Bien-être",
    date: "16 septembre 2025",
    content: "Je tiens à remercier Mr Grondin pour son super travail. Du début à la fin du projet, il a su m'accompagner à chaque étape avec une réactivité impressionnante. Au-delà de ses compétences techniques, c'est une personne humaine, à l'écoute et disponible, qui a su comprendre mes besoins et proposer des solutions adaptées. Je le recommande sans hésitation pour tout projet nécessitant sérieux, efficacité et une véritable relation de confiance.",
    initials: "AD",
    rating: 5,
  },
  {
    name: "s4d400ae0",
    role: "Client - Création d'application",
    date: "18 juin 2025",
    content: "Jayan s'est montré disponible et a su dépasser mes attentes. Il est de très bon conseil je vous le recommande si vous avez un projet.",
    initials: "S4",
    rating: 5,
  },
  {
    name: "n255caaf7",
    role: "Client - SaaS IA E-commerce",
    date: "20 avril 2025",
    content: "J'ai collaboré avec Jayan et son équipe sur un projet tech ambitieux, et je suis vraiment satisfait du résultat. Leur réactivité, leur compréhension rapide des besoins, et surtout leur capacité à livrer du code propre et fonctionnel m'ont impressionné. Ils sont sérieux, organisés et savent s'adapter. Je recommande fortement son agence à quiconque cherche un partenaire fiable pour du développement web ou d'applications.",
    initials: "N2",
    rating: 5,
  },
];

const Testimonials = () => {
  const [isVisible, setIsVisible] = useState(false);
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
    <section ref={sectionRef} id="temoignages" className="relative py-24 overflow-hidden text-white">
      <style>
        {`
          @keyframes sway {
            0% { transform: translateX(-50%) rotate(-25deg); }
            100% { transform: translateX(-50%) rotate(25deg); }
          }
        `}
      </style>
      
      <div className="w-full max-w-[95%] mx-auto px-4 relative z-10">
        <div className={`relative overflow-hidden rounded-[2.5rem] bg-black/40 border border-white/10 backdrop-blur-md p-8 md:p-12 lg:p-16 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          
          {/* Ocean Light Effect */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
             {/* Deep ambient glow */}
             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-primary/30 blur-[120px] opacity-60" />
             
             {/* Moving Light Rays */}
             <div 
               className="absolute -top-[200px] left-1/2 w-[200%] h-[1200px] bg-[conic-gradient(from_180deg_at_50%_0%,transparent_45%,rgba(255,255,255,0.3)_48%,transparent_50%,rgba(255,255,255,0.3)_52%,transparent_55%)] blur-3xl origin-top"
               style={{ animation: 'sway 12s ease-in-out infinite alternate' }}
             />
             
             {/* Stronger top highlight */}
             <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-white/20 via-primary/10 to-transparent blur-2xl" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto flex flex-col items-center text-center mb-16 space-y-6">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-lg">
               <span className="relative flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
               </span>
               <span className="text-sm font-medium text-white/90">Témoignages</span>
            </div>

            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
              Avis clients
            </h2>
            <p className="text-lg md:text-xl text-[#F69292]/70 max-w-2xl mx-auto">
              La confiance de nos clients, notre meilleure référence
            </p>

            <Button 
              size="lg"
              className="bg-primary hover:bg-primary/90 text-white rounded-full px-8 h-12 shadow-lg shadow-primary/25"
              onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Prendre rendez-vous
            </Button>
          </div>
        
          <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card 
                key={index}
                className={`bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 hover:border-primary/30 transition-all duration-500 hover:-translate-y-2 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                style={{ transitionDelay: `${200 + index * 100}ms` }}
              >
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 bg-primary/20 text-primary border border-primary/30">
                      <AvatarFallback>{testimonial.initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold text-white">{testimonial.name}</p>
                      <p className="text-sm text-[#F69292]/70">{testimonial.role}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-1">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>
                  
                  <p className="text-sm text-white leading-relaxed">
                    "{testimonial.content}"
                  </p>
                  
                  <p className="text-xs text-[#F69292]/40">
                    Évalué le {testimonial.date}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
