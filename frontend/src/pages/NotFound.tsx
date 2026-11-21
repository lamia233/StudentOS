import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <Compass className="h-10 w-10 text-brand-500" />
      <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
      <p className="mt-1 text-sm text-slate-500">That page doesn't exist in your StudentOS.</p>
      <Link to="/app" className="mt-5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Back to dashboard</Link>
    </div>
  );
}
