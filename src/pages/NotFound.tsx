import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import GlobalBackground from "@/components/GlobalBackground";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-white relative selection:bg-primary/30 overflow-hidden">
      <GlobalBackground />
      
      <div className="text-center relative z-10 p-6">
        <h1 className="text-9xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-primary to-white animate-pulse">404</h1>
        <p className="text-2xl mb-8 text-gray-300">Oups ! Cette page semble avoir disparu dans le cyberespace.</p>
        <a href="/" className="text-primary underline hover:text-primary/80 transition-colors">
          Retourner à l'accueil
        </a>
      </div>
    </div>
  );
};

export default NotFound;
