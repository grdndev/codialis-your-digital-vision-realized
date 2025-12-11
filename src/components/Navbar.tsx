import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Expertises", href: "/#expertises" },
    { name: "Réalisations", href: "/#realisations" },
    { name: "Témoignages", href: "/#temoignages" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? "bg-[#0E4272]/90 backdrop-blur-xl border-b border-white/10 py-4"
          : "bg-transparent py-6"
      }`}
    >
      <div className="container mx-auto px-6 flex items-center justify-between">
        <Link 
          to="/" 
          className="text-2xl font-bold tracking-tighter flex items-center gap-2 text-white transition-all duration-300 hover:opacity-80"
        >
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-bold shadow-[0_0_20px_rgba(246,146,146,0.5)] transition-all duration-300 hover:shadow-[0_0_30px_rgba(246,146,146,0.7)] hover:scale-105">
            C
          </div>
          <span className="bg-gradient-to-r from-white to-[#F69292] bg-clip-text text-transparent">
            Codialis
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="relative text-sm font-medium text-[#F69292]/80 hover:text-white transition-all duration-300 group"
            >
              {link.name}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
          <Button 
            asChild 
            className="bg-white text-[#0E4272] hover:bg-[#F69292] hover:text-[#0E4272] rounded-full px-6 h-10 text-sm font-medium border-0 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]"
          >
            <a href="/#contact">Démarrer un projet</a>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <div 
        className={`absolute top-full left-0 right-0 bg-[#0E4272]/95 backdrop-blur-xl border-b border-white/10 md:hidden overflow-hidden transition-all duration-500 ${
          isMobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="p-6 flex flex-col gap-2">
          {navLinks.map((link, index) => (
            <a
              key={link.name}
              href={link.href}
              className="text-lg font-medium text-[#F69292]/80 hover:text-white py-3 px-4 rounded-lg hover:bg-white/5 transition-all duration-300"
              style={{ transitionDelay: `${index * 50}ms` }}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {link.name}
            </a>
          ))}
          <Button 
            asChild 
            className="w-full mt-4 bg-white text-[#0E4272] hover:bg-[#F69292] hover:text-[#0E4272] rounded-full h-12 text-base font-medium shadow-[0_0_20px_rgba(246,146,146,0.3)] hover:shadow-[0_0_30px_rgba(246,146,146,0.5)] transition-all duration-300"
          >
            <a href="/#contact" onClick={() => setIsMobileMenuOpen(false)}>
              Démarrer un projet
            </a>
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;