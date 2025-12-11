import { Button } from "@/components/ui/button";
import { useEffect, useState, useRef } from "react";

const Hero = () => {
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
    <section ref={sectionRef} className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 pb-0 text-white">
      {/* Removed local background glows to use global background */}
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-5xl mx-auto text-center flex flex-col items-center">
          
          {/* Main Heading */}
          <h1 className={`text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-tight mb-6 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            Développement sur mesure
            <br />
            <span className="bg-gradient-to-r from-[#F69292] to-[#0E4272] bg-clip-text text-transparent">Résultats concrets</span>
          </h1>
          
          {/* Subheading */}
          <p className={`text-lg md:text-xl text-[#F69292] max-w-2xl mx-auto mb-10 transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            Apps, SaaS, CRM/ERP, IA, Jeux & Réalité Mixte
          </p>
          
          {/* Buttons */}
          <div className={`flex flex-col sm:flex-row gap-4 justify-center items-center transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <Button 
              size="lg"
              className="bg-[#F69292] text-[#0E4272] hover:bg-[#F69292]/90 rounded-full px-8 h-12 text-base font-medium border-0 transition-all duration-300 hover:shadow-[0_0_20px_rgba(246,146,146,0.3)] hover:-translate-y-1"
              onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Demander un devis
            </Button>
            
            <Button 
              variant="outline" 
              size="lg"
              className="bg-white/5 text-white border-white/10 hover:bg-white/10 hover:border-primary/50 backdrop-blur-sm rounded-full px-8 h-12 text-base font-medium transition-all duration-300"
            >
              Prendre un rendez-vous
            </Button>
          </div>
          
          {/* Metrics */}
          <div className={`mt-20 pt-10 flex flex-wrap gap-8 md:gap-16 items-center justify-center transition-all duration-1000 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="text-center">
              <span className="text-3xl md:text-4xl font-bold text-white block mb-1">50+</span>
              <p className="text-sm text-[#F69292]/80">Projets livrés</p>
            </div>
            <div className="text-center">
              <span className="text-3xl md:text-4xl font-bold text-white block mb-1">98%</span>
              <p className="text-sm text-[#F69292]/80">Satisfaction client</p>
            </div>
            <div className="text-center">
              <span className="text-3xl md:text-4xl font-bold text-white block mb-1">7+</span>
              <p className="text-sm text-[#F69292]/80">Années d'expertise</p>
            </div>
            <div className="text-center">
              <span className="text-3xl md:text-4xl font-bold text-white block mb-1">24h</span>
              <p className="text-sm text-[#F69292]/80">Temps de réponse</p>
            </div>
          </div>
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

export default Hero;
