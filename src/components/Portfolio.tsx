import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  Bot,
  Calendar,
  Workflow,
  Cloud as CloudIcon,
  Heart,
  Car,
} from "lucide-react";

const projects = [
  {
    icon: ShoppingCart,
    title: "Application e-commerce billets",
    description:
      "Plateforme complète de vente de billets avec intégration Stripe",
    tags: ["Stripe", "E-commerce", "React"],
  },
  {
    icon: Bot,
    title: "SaaS IA pour e-commerce",
    description:
      "Solution d'intelligence artificielle pour optimiser les ventes en ligne",
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
    description:
      "Infrastructure cloud sécurisée et conforme aux normes européennes",
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
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground">
            Réalisations
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Projets ambitieux, résultats mesurables
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((project, index) => (
            <Card
              key={index}
              className="group hover:shadow-hover transition-all duration-300 hover:-translate-y-2"
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-4">
                  <div className="text-primary transition-transform group-hover:scale-110 duration-300">
                    <project.icon className="h-10 w-10" />
                  </div>
                </div>
                <CardTitle className="text-xl text-left">
                  {project.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <CardDescription className="text-base text-left leading-relaxed">
                  {project.description}
                </CardDescription>
                <div className="flex flex-wrap gap-2">
                  {project.tags.map((tag, tagIndex) => (
                    <Badge
                      key={tagIndex}
                      variant="secondary"
                      className="text-xs"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Portfolio;
