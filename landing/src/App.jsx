import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import HomePage from '@/pages/HomePage';

// Lazy load secondary pages (bundle-dynamic-imports pattern)
const AboutPage = lazy(() => import('@/pages/AboutPage'));
const SolutionsPage = lazy(() => import('@/pages/SolutionsPage'));
const ContactPage = lazy(() => import('@/pages/ContactPage'));

function PageFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center section-dark">
      <div className="w-8 h-8 rounded-full border-2 border-dark-border border-t-ifrit-red animate-spin" />
    </div>
  );
}

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <ScrollToTop />
      <Header />
      <main id="main-content">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/solutions" element={<SolutionsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="*" element={
              <div className="section-dark min-h-[60vh] flex flex-col items-center justify-center text-center py-32">
                <h1 className="text-6xl font-display font-bold text-ifrit-red mb-4">404</h1>
                <p className="text-text-on-dark-muted text-lg">Page not found.</p>
              </div>
            } />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
