import Hero from '@/components/sections/Hero';
import Problem from '@/components/sections/Problem';
import Features from '@/components/sections/Features';
import TechStack from '@/components/sections/TechStack';
import CtaBanner from '@/components/sections/CtaBanner';
import TrustSignals from '@/components/sections/TrustSignals';
import ContactCta from '@/components/sections/ContactCta';

export default function HomePage() {
  return (
    <>
      <Hero />
      <Problem />
      <Features />
      <TechStack />
      <CtaBanner />
      <TrustSignals />
      <ContactCta />
    </>
  );
}
