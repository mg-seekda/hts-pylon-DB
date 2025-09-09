import React from 'react';
import { Github } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 border-t border-gray-700 py-3 px-6">
      <div className="flex items-center justify-center space-x-2 text-gray-400 text-sm">
        <span>HTS Dashboard</span>
        <span>•</span>
        <a
          href="https://github.com/mg-seekda/hts-pylon-DB"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-1 hover:text-white transition-colors"
          title="View on GitHub"
        >
          <Github className="w-4 h-4" />
          <span>GitHub</span>
        </a>
      </div>
    </footer>
  );
};

export default Footer;
