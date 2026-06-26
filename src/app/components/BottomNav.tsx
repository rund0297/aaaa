import { Home, Package, Map, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { motion } from 'motion/react';

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { id: 'dashboard', icon: Home, label: '홈', path: '/dashboard' },
    { id: 'cabinet', icon: Package, label: '보관함', path: '/cabinet' },
    { id: 'map', icon: Map, label: '지도', path: '/map' },
    { id: 'profile', icon: User, label: '프로필', path: '/profile' },
  ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-[20px] border-t border-gray-200/50 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] rounded-t-[32px]"
      style={{ height: '96px' }}
    >
      {/* 4 equal columns with 12px gap, 16px top/bottom padding */}
      <div className="grid grid-cols-4 gap-3 h-full px-4 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className="relative flex flex-col items-center justify-center gap-1"
            >
              {/* Icon with 110% scale when active */}
              <motion.div
                animate={{ scale: isActive ? 1.1 : 1 }}
                transition={{ type: 'spring', damping: 15, stiffness: 300, duration: 0.3 }}
              >
                <Icon
                  className={`size-6 ${
                    isActive ? 'text-[#F43F5E]' : 'text-gray-400'
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </motion.div>

              <motion.span
                animate={{ opacity: isActive ? 1 : 0.7 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className={`text-xs ${
                  isActive ? 'text-[#F43F5E]' : 'text-gray-500'
                }`}
                style={{ fontWeight: isActive ? 700 : 500 }}
              >
                {item.label}
              </motion.span>

              {/* Pulsing 4px dot indicator */}
              {isActive && (
                <motion.div
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 size-1 bg-[#F43F5E] rounded-full"
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [1, 0.6, 1]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
