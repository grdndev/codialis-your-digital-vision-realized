import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star } from "lucide-react";

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
  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground">
            Avis clients
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            La confiance de nos clients, notre meilleure référence
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <Card 
              key={index}
              className="hover:shadow-hover transition-all duration-300"
            >
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 bg-primary/10 text-primary">
                    <AvatarFallback>{testimonial.initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
                
                <div className="flex gap-1">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-secondary text-secondary" />
                  ))}
                </div>
                
                <p className="text-sm text-muted-foreground leading-relaxed">
                  "{testimonial.content}"
                </p>
                
                <p className="text-xs text-muted-foreground">
                  Évalué le {testimonial.date}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
