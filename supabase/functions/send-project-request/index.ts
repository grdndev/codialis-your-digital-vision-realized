import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProjectRequest {
  name: string;
  email: string;
  projectType: string;
  technologies: string;
  budget: string;
  message: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, projectType, technologies, budget, message }: ProjectRequest = await req.json();
    
    console.log("Project request received from:", email);

    // Format the project type for better readability
    const projectTypeLabels: Record<string, string> = {
      "app-mobile": "Application mobile",
      "saas": "Logiciel SaaS",
      "erp-crm": "ERP/CRM",
      "jeux": "Jeux vidéo / VR/AR",
      "ia": "Intégration IA",
      "cloud": "Infrastructure Cloud",
      "autre": "Autre"
    };

    const budgetLabels: Record<string, string> = {
      "5k-10k": "5 000€ - 10 000€",
      "10k-25k": "10 000€ - 25 000€",
      "25k-50k": "25 000€ - 50 000€",
      "50k+": "50 000€+",
      "non-defini": "Non défini"
    };

    // Send email to jayan@codialis.com
    const emailResponse = await resend.emails.send({
      from: "CODIALIS <contact@codialis.com>",
      to: ["jayan@codialis.com"], 
      subject: `Nouvelle demande de devis - ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a1a; border-bottom: 3px solid #0EA5E9; padding-bottom: 10px;">
            Nouvelle demande de devis
          </h1>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #0EA5E9; margin-top: 0;">Informations du client</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 40%;">Nom :</td>
                <td style="padding: 8px 0;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Email :</td>
                <td style="padding: 8px 0;"><a href="mailto:${email}" style="color: #0EA5E9;">${email}</a></td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #0EA5E9; margin-top: 0;">Détails du projet</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 40%;">Type de projet :</td>
                <td style="padding: 8px 0;">${projectTypeLabels[projectType] || projectType || "Non spécifié"}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Budget estimé :</td>
                <td style="padding: 8px 0;">${budgetLabels[budget] || budget || "Non spécifié"}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; vertical-align: top;">Technologies :</td>
                <td style="padding: 8px 0;">${technologies || "Non spécifié"}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #0EA5E9; margin-top: 0;">Description du projet</h2>
            <p style="line-height: 1.6; color: #475569; white-space: pre-wrap;">${message}</p>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="color: #64748b; font-size: 12px; margin: 0;">
              Cette demande a été soumise via le formulaire de contact du site CODIALIS.
            </p>
            <p style="color: #64748b; font-size: 12px; margin: 5px 0 0 0;">
              Répondez rapidement pour transformer cette opportunité en projet !
            </p>
          </div>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-project-request function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
