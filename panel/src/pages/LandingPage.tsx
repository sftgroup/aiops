import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import Stats from './components/Stats';
import PricingSection from './components/PricingSection';
import Footer from './components/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-dark-bg text-white overflow-x-hidden">
      <Navbar />
      <Hero />
      <Features />
      <Stats />
      <PricingSection />
      <Footer />
    </div>
  );
}
