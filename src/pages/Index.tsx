import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Expertise from "@/components/Expertise";
import Portfolio from "@/components/Portfolio";
import Testimonials from "@/components/Testimonials";
import ContactForm from "@/components/ContactForm";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";
import GlobalBackground from "@/components/GlobalBackground";

const Index = () => {
  return (
    <div className="min-h-screen bg-black relative selection:bg-purple-500/30 dark">
      <GlobalBackground />

      {/* Content Layer */}
      <div className="relative z-10">
        <Navbar />
        <Hero />
        <Expertise />
        <Portfolio />
        <Testimonials />
        <ContactForm />
        <FinalCTA />
        <Footer />
      </div>
    </div>
  );
};

export default Index;
