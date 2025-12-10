import { Link, useLocation } from "react-router-dom";

const Navbar = () => {
  const location = useLocation();
  const onHome = location.pathname === "/";

  return (
    <div className="flex h-16 items-center justify-between bg-[#0f172a] px-6 text-white shadow-md">
      <Link
        to="/"
        className="text-xl font-semibold tracking-tight"
        aria-label="SESAP Playground"
      >
        SESAP Playground
      </Link>
      <div className="flex items-center gap-3 text-sm text-slate-200">
        <span className="hidden sm:inline">Template · Model · Data</span>
        {!onHome && (
          <Link
            to="/"
            className="rounded-md border border-white/20 px-3 py-1 text-xs font-medium text-white hover:border-white/40"
          >
            Back to editor
          </Link>
        )}
      </div>
    </div>
  );
};

export default Navbar;
