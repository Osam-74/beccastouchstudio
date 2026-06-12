import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-silk pt-32 pb-24 px-6 flex items-center justify-center">
      <div className="max-w-xl w-full rounded-[36px] border border-[#ead1d7] bg-white shadow-[0_30px_100px_rgba(33,20,26,0.08)] p-10 text-center">
        <p className="section-label text-[#8c5a65] mb-4">404</p>
        <h1 className="font-display text-5xl text-[#171314] mb-4">Page not found</h1>
        <p className="text-[#5d4b4f] mb-8">The page you tried to open does not exist or is not available from this route.</p>
        <Link to="/" className="btn-ink">Return Home</Link>
      </div>
    </div>
  );
}
