import Footer from "@/components/Footer";
import PrivatePolicy from "@/components/PrivatePolicy";

const PrivatePolicyPage = () => {
    return (
      <div className="min-h-screen flex flex-col bg-white text-slate-900">
        <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <PrivatePolicy />
        </main>
        <Footer />
      </div>
    )
  }

export default PrivatePolicyPage;
