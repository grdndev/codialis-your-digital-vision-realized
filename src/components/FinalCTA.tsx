import { Button } from "@/components/ui/button";
import { Calendar, FileText } from "lucide-react";

const FinalCTA = () => {
  return (
    <section className="py-24 bg-gradient-primary relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(246,146,146,0.1),transparent_50%)]" />
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold text-primary-foreground">
            Un projet ambitieux ?
            <span className="block mt-2">Un partenaire expérimenté.</span>
          </h2>
          
          <p className="text-xl text-primary-foreground/90 max-w-2xl mx-auto">
            Transformons ensemble vos idées en solutions digitales performantes
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <Button 
              size="lg"
              className="bg-background text-primary hover:bg-background/90 shadow-hover"
              onClick={() => window.open('https://calendly.com/grdndevelopment/consulting', '_blank')}
            >
              <Calendar className="mr-2 h-5 w-5" />
              Réserver une session stratégique
            </Button>
            
            <Button 
              size="lg"
              variant="heroSecondary"
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
