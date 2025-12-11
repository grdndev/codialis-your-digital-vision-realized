import { Mail, Linkedin, Github, Instagram } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-black/40 backdrop-blur-md text-white py-12 border-t border-white/10 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-[200px] bg-primary/20 blur-[100px] rounded-full pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold shadow-[0_0_15px_rgba(246,146,146,0.5)]">
                C
              </div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-[#F69292] bg-clip-text text-transparent">Codialis</h3>
            </div>
            <p className="text-[#F69292]/70">
              Agence de développement sur mesure, spécialisée dans les solutions innovantes et performantes.
            </p>
            <div className="flex items-center gap-2 text-[#F69292]/70">
              <Mail className="h-4 w-4 text-primary" />
              <a href="mailto:contact@codialis.com" className="hover:text-white transition-colors">
                contact@codialis.com
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="font-semibold text-white">Liens utiles</h4>
            <ul className="space-y-2">
              <li>
                <a href="#expertises" className="text-[#F69292]/70 hover:text-primary transition-colors">
                  Nos expertises
                </a>
              </li>
              <li>
                <a href="#realisations" className="text-[#F69292]/70 hover:text-primary transition-colors">
                  Réalisations
                </a>
              </li>
              <li>
                <a href="#contact" className="text-[#F69292]/70 hover:text-primary transition-colors">
                  Contact
                </a>
              </li>
              <li>
                <Link to="/legalmention" className="text-[#F69292]/70 hover:text-primary transition-colors">
                  Mentions légales
                </Link>
              </li>
              <li>
                <Link to="/privatepolicy" className="text-[#F69292]/70 hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Social Links */}
          <div className="space-y-4">
            <h4 className="font-semibold text-white">Nous suivre</h4>
            <div className="flex gap-4">
              <a 
                href="https://www.linkedin.com/company/codialis/"
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-primary hover:border-primary hover:text-primary-foreground transition-all duration-300 hover:shadow-[0_0_15px_rgba(246,146,146,0.5)]"
              >
                <Linkedin className="h-5 w-5" />
              </a>
              {/* <a 
                href="https://github.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-primary hover:border-primary hover:text-primary-foreground transition-all duration-300 hover:shadow-[0_0_15px_rgba(246,146,146,0.5)]"
              >
                <Github className="h-5 w-5" />
              </a> */}
              <a 
                href="https://www.instagram.com/codialis.dev/"
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-primary hover:border-primary hover:text-primary-foreground transition-all duration-300 hover:shadow-[0_0_15px_rgba(246,146,146,0.5)]"
              >
                <Instagram className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 text-center text-sm text-[#F69292]/50">
          <p>© {new Date().getFullYear()} Codialis. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
