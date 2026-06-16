import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import PageSkeleton from '@/components/ui/skeleton/PageSkeleton';
import HomePage from '@/pages/HomePage';

// Lazy load secondary pages (bundle-dynamic-imports pattern)
const AboutPage = lazy(() => import('@/pages/AboutPage'));
const SolutionsPage = lazy(() => import('@/pages/SolutionsPage'));
const ContactPage = lazy(() => import('@/pages/ContactPage'));

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
        <Suspense fallback={<PageSkeleton />}>
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
