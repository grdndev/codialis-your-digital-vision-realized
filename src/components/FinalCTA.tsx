import { Button } from "@/components/ui/button";
import { Calendar, FileText } from "lucide-react";
import { useEffect, useState, useRef } from "react";

const FinalCTA = () => {
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
    <section ref={sectionRef} className="py-24 relative overflow-hidden">
      {/* Removed local background glows */}
      
      <div className="container mx-auto px-6 relative z-10">
        <div className={`max-w-4xl mx-auto text-center space-y-8 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight">
            Un projet ambitieux ?
            <span className="block mt-2 bg-gradient-to-r from-primary to-white bg-clip-text text-transparent">Un partenaire expérimenté.</span>
          </h2>
          
          <p className="text-xl text-[#F69292]/70 max-w-2xl mx-auto">
            Transformons ensemble vos idées en solutions digitales performantes
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <Button 
              size="lg"
              className="bg-white text-black hover:bg-[#F69292] hover:text-[#0E4272] rounded-full px-8 h-12 text-base font-medium border-0 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:-translate-y-1"
              onClick={() => window.open('https://calendly.com/grdndevelopment/consulting', '_blank')}
            >
              <Calendar className="mr-2 h-5 w-5" />
              Réserver une session stratégique
            </Button>
            
            <Button 
              size="lg"
              variant="outline"
              className="bg-white/5 text-white border-white/10 hover:bg-white/10 hover:border-primary/50 rounded-full px-8 h-12 text-base font-medium backdrop-blur-sm transition-all duration-300"
              onClick={() => {
                // In a real implementation, this would trigger a PDF download
                alert('La plaquette PDF sera bientôt disponible au téléchargement');
              }}
            >
              <FileText className="mr-2 h-5 w-5" />
              Recevoir la plaquette PDF
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
