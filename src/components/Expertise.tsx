import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Laptop, Database, Gamepad2, Brain, Cloud } from "lucide-react";
import { useEffect, useState, useRef } from "react";

const expertises = [
  {
    icon: Smartphone,
    title: "Apps mobiles",
    description: "React Native, Flutter, Windev",
  },
  {
    icon: Laptop,
    title: "Logiciels SaaS",
    description: "Django, Laravel, Next.js",
  },
  {
    icon: Database,
    title: "ERP/CRM personnalisés",
    description: "Symfony, Webdev, PHP",
  },
  {
    icon: Gamepad2,
    title: "Jeux vidéo, VR/AR",
    description: "Unity, Unreal, WebXR",
  },
  {
    icon: Brain,
    title: "Intégrations IA/API",
    description: "OpenAI, JotForm, N8N, Mistral",
  },
  {
    icon: Cloud,
    title: "Infrastructure & Cloud souverain",
    description: "Node.js, Firebase, MySQL, Arduino",
  },
];

const Expertise = () => {
  const [rotation, setRotation] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const rotationInterval = setInterval(() => {
      setRotation(prev => (prev + 0.3) % 360);
    }, 50);

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      clearInterval(rotationInterval);
      observer.disconnect();
    };
  }, []);

  return (
    <section ref={sectionRef} id="expertises" className="relative pt-16 pb-24 overflow-hidden text-white">
      {/* Removed local background glows */}
      
      <div className="container mx-auto px-6 relative z-10">
        {/* Rotating Floating Icons in Circle */}
        <div className={`relative flex justify-center items-center mb-16 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="relative w-64 h-64 md:w-80 md:h-80">
            {/* Outer rotating ring */}
            <div 
              className="absolute inset-0 rounded-full border border-primary/20"
              style={{ transform: `rotate(${rotation}deg)` }}
            />
            <div 
              className="absolute inset-4 rounded-full border border-primary/10"
              style={{ transform: `rotate(${-rotation * 0.5}deg)` }}
            />
            
            {expertises.map((expertise, index) => {
              const baseAngle = index * 60 - 90;
              const animatedAngle = baseAngle + rotation;
              const angleRad = animatedAngle * (Math.PI / 180);
              const radius = 120;
              const x = Math.cos(angleRad) * radius;
              const y = Math.sin(angleRad) * radius;
              
              return (
                <div
                  key={index}
                  className="absolute w-14 h-14 md:w-16 md:h-16 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm flex items-center justify-center transition-all duration-300 hover:scale-125 hover:bg-primary/30 hover:border-primary/50 cursor-pointer"
                  style={{
                    left: `calc(50% + ${x}px - 28px)`,
                    top: `calc(50% + ${y}px - 28px)`,
                    boxShadow: '0 0 20px rgba(246, 146, 146, 0.2)',
                  }}
                >
                  <expertise.icon className="h-6 w-6 md:h-7 md:w-7 text-primary" />
                </div>
              );
            })}
            
            {/* Animated center glow */}
            <div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-primary/40 blur-xl rounded-full"
              style={{ 
                animation: 'pulse 3s ease-in-out infinite',
                transform: `translate(-50%, -50%) scale(${1 + Math.sin(rotation * 0.02) * 0.2})`,
              }} 
            />
            <div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-primary/60 blur-lg rounded-full"
              style={{ animation: 'pulse 2s ease-in-out infinite reverse' }} 
            />
          </div>
        </div>

        {/* Central Text */}
        <div className={`text-center mb-16 space-y-4 transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
            Nos expertises
          </h2>
          <p className="text-lg md:text-xl text-[#F69292]/70 max-w-2xl mx-auto">
            Des solutions technologiques complètes pour transformer vos idées en réalité
          </p>
        </div>
        
        {/* Expertise Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {expertises.map((expertise, index) => (
            <Card 
              key={index} 
              className={`group bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 hover:border-primary/30 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(246,146,146,0.2)] ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{ transitionDelay: `${500 + index * 100}ms` }}
            >
              <CardHeader>
                <div className="mb-4 w-14 h-14 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:bg-primary/40 group-hover:rotate-12">
                  <expertise.icon className="h-7 w-7 text-primary transition-colors group-hover:text-white" />
                </div>
                <CardTitle className="text-xl text-white">{expertise.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base text-[#F69292]/70">
                  {expertise.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-20px) translateX(10px); }
          50% { transform: translateY(-10px) translateX(-10px); }
          75% { transform: translateY(-25px) translateX(5px); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.2); }
        }
      `}</style>
    </section>
  );
};

export default Expertise;
