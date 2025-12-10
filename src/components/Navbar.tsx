import { useState } from 'react';
import { Link, useLocation } from "react-router-dom";
import { Button } from "antd";
import { ThunderboltOutlined } from "@ant-design/icons";
import TranscriptUpload from "./TranscriptUpload";

const Navbar = () => {
  const location = useLocation();
  const onHome = location.pathname === "/";
  const [showUpload, setShowUpload] = useState(false);

  return (
    <>
      <div className="flex h-16 items-center justify-between bg-[#0f172a] px-6 text-white shadow-md">
        <Link
          to="/"
          className="text-xl font-semibold tracking-tight"
          aria-label="SESAP Playground"
        >
          SESAP Playground
        </Link>
        <div className="flex items-center gap-3 text-sm text-slate-200">
          {onHome && (
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={() => setShowUpload(true)}
              style={{
                background: 'linear-gradient(135deg, #19c6c7 0%, #0ea5e9 100%)',
                border: 'none',
              }}
            >
              Generate Contract
            </Button>
          )}
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

      <TranscriptUpload open={showUpload} onClose={() => setShowUpload(false)} />
    </>
  );
};

export default Navbar;

