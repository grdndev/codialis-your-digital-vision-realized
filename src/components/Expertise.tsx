import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Laptop, Database, Gamepad2, Brain, Cloud } from "lucide-react";

const expertises = [
  {
    icon: Smartphone,
    title: "Apps mobiles",
    description: "React Native, Flutter, Windev",
    color: "text-primary",
  },
  {
    icon: Laptop,
    title: "Logiciels SaaS",
    description: "Django, Laravel, Next.js",
    color: "text-secondary",
  },
  {
    icon: Database,
    title: "ERP/CRM personnalisés",
    description: "Symfony, Webdev, PHP",
    color: "text-primary",
  },
  {
    icon: Gamepad2,
    title: "Jeux vidéo, VR/AR",
    description: "Unity, Unreal, WebXR",
    color: "text-secondary",
  },
  {
    icon: Brain,
    title: "Intégrations IA/API",
    description: "OpenAI, JotForm, N8N, Mistral",
    color: "text-primary",
  },
  {
    icon: Cloud,
    title: "Infrastructure & Cloud souverain",
    description: "Node.js, Firebase, MySQL, Arduino",
    color: "text-secondary",
  },
];

const Expertise = () => {
  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground">
            Nos expertises
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Des solutions technologiques complètes pour transformer vos idées en réalité
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {expertises.map((expertise, index) => (
            <Card 
              key={index} 
              className="group hover:shadow-hover transition-all duration-300 hover:-translate-y-2 border-border/50"
            >
              <CardHeader>
                <div className={`${expertise.color} mb-4 transition-transform group-hover:scale-110 duration-300`}>
                  <expertise.icon className="h-12 w-12" />
                </div>
                <CardTitle className="text-xl">{expertise.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  {expertise.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Expertise;
