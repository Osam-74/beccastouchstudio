import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Toast from './components/Toast';
import MobileDock from './components/MobileDock';
import Home from './pages/Home';
import BookStudio from './pages/BookStudio';
import BookGlam from './pages/BookGlam';
import TrackBooking from './pages/TrackBooking';
import Shop from './pages/Shop';
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';
import { ToastProvider } from './context/ToastContext';

const githubBasename = typeof window !== 'undefined' && window.location.hostname.includes('github.io')
  ? '/beccastouchstudio'
  : '/';

function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, search]);

  return null;
}

function ManifestManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    const manifest = document.getElementById('app-manifest');
    if (manifest) {
      manifest.setAttribute('href', pathname.startsWith('/sg-bec') ? './admin-manifest.webmanifest' : './manifest.webmanifest');
    }
  }, [pathname]);

  return null;
}

function Shell() {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/sg-bec');
  const hideChrome = isAdmin || pathname === '/not-found';

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <ScrollToTop />
      <ManifestManager />
      {!hideChrome && <Navbar />}
      <main className="flex-1 pb-24 md:pb-0">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/book-studio" element={<BookStudio />} />
          <Route path="/book-glam" element={<BookGlam />} />
          <Route path="/track-booking" element={<TrackBooking />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/sg-bec" element={<Admin />} />
          <Route path="/not-found" element={<NotFound />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!hideChrome && <Footer />}
      {!hideChrome && <MobileDock />}
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter basename={githubBasename}>
        <Shell />
      </BrowserRouter>
    </ToastProvider>
  );
}
