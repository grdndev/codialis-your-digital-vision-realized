import { useState } from "react";
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
    <section id="contact" className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground">
            Demande de devis
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Parlez-nous de votre projet, nous vous répondons sous 24h
          </p>
        </div>

        <Card className="max-w-3xl mx-auto shadow-elegant">
          <CardHeader>
            <CardTitle>Formulaire de contact</CardTitle>
            <CardDescription>
              Remplissez ce formulaire et recevez votre devis personnalisé
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom complet *</Label>
                  <Input
                    id="name"
                    placeholder="Jean Dupont"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="jean@exemple.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="projectType">Type de projet</Label>
                  <Select
                    value={formData.projectType}
                    onValueChange={(value) => setFormData({ ...formData, projectType: value })}
                  >
                    <SelectTrigger id="projectType">
                      <SelectValue placeholder="Sélectionnez un type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="app-mobile">Application mobile</SelectItem>
                      <SelectItem value="saas">Logiciel SaaS</SelectItem>
                      <SelectItem value="erp-crm">ERP/CRM</SelectItem>
                      <SelectItem value="jeux">Jeux vidéo / VR/AR</SelectItem>
                      <SelectItem value="ia">Intégration IA</SelectItem>
                      <SelectItem value="cloud">Infrastructure Cloud</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budget">Budget estimé</Label>
                  <Select
                    value={formData.budget}
                    onValueChange={(value) => setFormData({ ...formData, budget: value })}
                  >
                    <SelectTrigger id="budget">
                      <SelectValue placeholder="Sélectionnez une fourchette" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5k-10k">5 000€ - 10 000€</SelectItem>
                      <SelectItem value="10k-25k">10 000€ - 25 000€</SelectItem>
                      <SelectItem value="25k-50k">25 000€ - 50 000€</SelectItem>
                      <SelectItem value="50k+">50 000€+</SelectItem>
                      <SelectItem value="non-defini">Non défini</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="technologies">Technologies souhaitées (optionnel)</Label>
                <Input
                  id="technologies"
                  placeholder="React, Node.js, Python..."
                  value={formData.technologies}
                  onChange={(e) => setFormData({ ...formData, technologies: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Décrivez votre projet *</Label>
                <Textarea
                  id="message"
                  placeholder="Parlez-nous de vos besoins, objectifs et contraintes..."
                  className="min-h-32"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  required
                />
              </div>

              <Button type="submit" size="lg" className="w-full" variant="hero" disabled={isSubmitting}>
                <Send className="mr-2 h-5 w-5" />
                {isSubmitting ? "Envoi en cours..." : "Recevoir mon devis sous 24h"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default ContactForm;
