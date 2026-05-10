import Hero from '@landing/components/sections/Hero';
import Problem from '@landing/components/sections/Problem';
import Features from '@landing/components/sections/Features';
import TechStack from '@landing/components/sections/TechStack';
import CtaBanner from '@landing/components/sections/CtaBanner';
import TrustSignals from '@landing/components/sections/TrustSignals';
import ContactCta from '@landing/components/sections/ContactCta';

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
