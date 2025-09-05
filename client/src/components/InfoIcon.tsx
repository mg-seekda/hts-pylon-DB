import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import InfoModal from './InfoModal';

interface InfoIconProps {
  title: string;
  description: string;
  features?: string[];
  position?: 'top-right' | 'bottom-right';
  className?: string;
}

const InfoIcon: React.FC<InfoIconProps> = ({ 
  title, 
  description, 
  features = [], 
  position = 'top-right',
  className = ''
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const positionClasses = {
    'top-right': 'absolute top-2 right-2',
    'bottom-right': 'absolute bottom-2 right-2'
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={(e) => {
          e.stopPropagation();
          setIsModalOpen(true);
        }}
        className={`
          ${positionClasses[position]}
          w-6 h-6 rounded-full bg-gray-700/80 hover:bg-gray-600/90 
          flex items-center justify-center text-gray-300 hover:text-white
          transition-all duration-200 z-10
          ${className}
        `}
        title={`Info about ${title}`}
        aria-label={`Show information about ${title}`}
      >
        <Info className="w-3 h-3" />
      </motion.button>

      <InfoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={title}
        description={description}
        features={features}
      />
    </>
  );
};

export default InfoIcon;
