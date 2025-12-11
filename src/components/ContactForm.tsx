import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ContactForm = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    projectType: "",
    technologies: "",
    budget: "",
    message: "", 
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name || !formData.email || !formData.message) {
      toast.error("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error("Veuillez entrer une adresse email valide.");
      return;
    }

    setIsSubmitting(true);

    try {
      console.log("🚀 Sending project request...");
      console.log("📝 Form data:", formData);

      const { data, error } = await supabase.functions.invoke("send-project-request", {
        body: formData,
      });

      console.log("📥 Response:", { data, error });

      if (error) {
        console.error("❌ Error sending project request:", error);
        toast.error(`Une erreur est survenue: ${error.message || "Veuillez réessayer."}`);
      } else if (data?.success) {
        console.log("✅ Email sent successfully!");
        toast.success("Message envoyé ! Nous vous répondrons sous 24h.");
        setFormData({
          name: "",
          email: "",
          projectType: "",
          technologies: "",
          budget: "",
          message: "",
        });
      } else {
        console.error("⚠️ Unexpected response:", data);
        toast.error("Une erreur est survenue. Veuillez réessayer.");
      }
    } catch (error) {
      console.error("💥 Exception caught:", error);
      toast.error("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      console.log("🏁 Request completed");
      setIsSubmitting(false);
    }
  };

  return (
    <section ref={sectionRef} id="contact" className="relative py-24 overflow-hidden text-white">
      {/* Removed local background glows */}

      <div className="container mx-auto px-6 relative z-10">
        <div className={`text-center mb-16 space-y-4 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
            Demande de devis
          </h2>
          <p className="text-lg md:text-xl text-[#F69292]/70 max-w-2xl mx-auto">
            Parlez-nous de votre projet, nous vous répondons sous 24h
          </p>
        </div>

        <Card className={`max-w-3xl mx-auto bg-white/5 border-white/10 backdrop-blur-sm shadow-[0_0_40px_rgba(0,0,0,0.3)] transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <CardHeader>
            <CardTitle className="text-white">Formulaire de contact</CardTitle>
            <CardDescription className="text-[#F69292]/70">
              Remplissez ce formulaire et recevez votre devis personnalisé
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-[#F69292]">Nom complet *</Label>
                  <Input
                    id="name"
                    placeholder="Jean Dupont"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="bg-white/5 border-white/10 text-white placeholder:text-[#F69292]/40 focus:border-primary/50 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[#F69292]">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="jean@exemple.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="bg-white/5 border-white/10 text-white placeholder:text-[#F69292]/40 focus:border-primary/50 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="projectType" className="text-[#F69292]">Type de projet</Label>
                  <Select
                    value={formData.projectType}
                    onValueChange={(value) => setFormData({ ...formData, projectType: value })}
                  >
                    <SelectTrigger id="projectType" className="bg-white/5 border-white/10 text-white focus:border-primary/50 focus:ring-primary/20">
                      <SelectValue placeholder="Sélectionnez un type" />
                    </SelectTrigger>
                    <SelectContent className="bg-black/90 border-white/10 text-white backdrop-blur-xl">
                      <SelectItem value="app-mobile" className="focus:bg-primary/20 focus:text-white">Application mobile</SelectItem>
                      <SelectItem value="saas" className="focus:bg-primary/20 focus:text-white">Logiciel SaaS</SelectItem>
                      <SelectItem value="erp-crm" className="focus:bg-primary/20 focus:text-white">ERP/CRM</SelectItem>
                      <SelectItem value="jeux" className="focus:bg-primary/20 focus:text-white">Jeux vidéo / VR/AR</SelectItem>
                      <SelectItem value="ia" className="focus:bg-primary/20 focus:text-white">Intégration IA</SelectItem>
                      <SelectItem value="cloud" className="focus:bg-primary/20 focus:text-white">Infrastructure Cloud</SelectItem>
                      <SelectItem value="autre" className="focus:bg-primary/20 focus:text-white">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budget" className="text-[#F69292]">Budget estimé</Label>
                  <Select
                    value={formData.budget}
                    onValueChange={(value) => setFormData({ ...formData, budget: value })}
                  >
                    <SelectTrigger id="budget" className="bg-white/5 border-white/10 text-white focus:border-primary/50 focus:ring-primary/20">
                      <SelectValue placeholder="Sélectionnez une fourchette" />
                    </SelectTrigger>
                    <SelectContent className="bg-black/90 border-white/10 text-white backdrop-blur-xl">
                      <SelectItem value="5k-10k" className="focus:bg-primary/20 focus:text-white">5 000€ - 10 000€</SelectItem>
                      <SelectItem value="10k-25k" className="focus:bg-primary/20 focus:text-white">10 000€ - 25 000€</SelectItem>
                      <SelectItem value="25k-50k" className="focus:bg-primary/20 focus:text-white">25 000€ - 50 000€</SelectItem>
                      <SelectItem value="50k+" className="focus:bg-primary/20 focus:text-white">50 000€+</SelectItem>
                      <SelectItem value="non-defini" className="focus:bg-primary/20 focus:text-white">Non défini</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="technologies" className="text-[#F69292]">Technologies souhaitées (optionnel)</Label>
                <Input
                  id="technologies"
                  placeholder="React, Node.js, Python..."
                  value={formData.technologies}
                  onChange={(e) => setFormData({ ...formData, technologies: e.target.value })}
                  className="bg-white/5 border-white/10 text-white placeholder:text-[#F69292]/40 focus:border-primary/50 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message" className="text-[#F69292]">Décrivez votre projet *</Label>
                <Textarea
                  id="message"
                  placeholder="Parlez-nous de vos besoins, objectifs et contraintes..."
                  className="min-h-32 bg-white/5 border-white/10 text-white placeholder:text-[#F69292]/40 focus:border-primary/50 focus:ring-primary/20"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  required
                />
              </div>

              <Button 
                type="submit" 
                size="lg" 
                className="w-full bg-white text-black hover:bg-[#F69292] hover:text-[#0E4272] rounded-full h-12 text-base font-medium border-0 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]" 
                disabled={isSubmitting}
              >
                <Send className="mr-2 h-5 w-5" />
                {isSubmitting ? "Envoi en cours..." : "Recevoir mon devis sous 24h"}
              </Button>
            </form>
          </CardContent>
        </Card>
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

export default ContactForm;
