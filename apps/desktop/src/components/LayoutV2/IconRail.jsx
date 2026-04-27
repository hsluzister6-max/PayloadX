import { useUIStore } from '@/store/uiStore';
import PayloadX from '@/components/core/logo';
import { 
  FolderOpen, 
  Layers, 
  BarChart2, 
  Zap, 
  BookOpen, 
  Settings, 
  Sun, 
  Moon, 
  Layout, 
  Monitor,
  Workflow
} from 'lucide-react';

const NAV_ITEMS = [
  {
    id: 'collections',
    label: 'Collections',
    icon: <FolderOpen size={18} />,
  },
  {
    id: 'workflow',
    label: 'API Automation',
    icon: <Workflow size={18} />,
  },
  {
    id: 'environments',
    label: 'Environments',
    icon: <Layers size={18} />,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <BarChart2 size={18} />,
  },
  {
    id: 'ai',
    label: 'AI Insights',
    icon: <Zap size={18} />,
  },
  {
    id: 'docs',
    label: 'Documentation',
    icon: <BookOpen size={18} />,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings size={18} />,
  },
];

export default function IconRail({ activePanel, setActivePanel }) {
  const { theme, toggleTheme, toggleLayout } = useUIStore();

  return (
    <div className="icon-rail" style={{ background: 'var(--rail-bg)', borderRight: '1px solid var(--border-1)' }}>
      {/* Logo */}
      <div className="rail-logo">
        <PayloadX className="w-10 h-10" fontSize="14px" />
      </div>

      {/* Nav items */}
      <nav className="rail-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = activePanel === item.id;
          return (
            <RailButton
              key={item.id}
              label={item.label}
              icon={item.icon}
              isActive={isActive}
              onClick={() => setActivePanel(isActive ? null : item.id)}
            />
          );
        })}
      </nav>

      {/* Bottom controls */}
      <div className="rail-footer">
        {/* Theme toggle */}
        <RailButton
          label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          icon={theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          isActive={false}
          onClick={toggleTheme}
        />

        <RailButton
          label="Classic Layout"
          icon={<Layout size={18} />}
          isActive={false}
          onClick={toggleLayout}
        />
      </div>
    </div>
  );
}

function RailButton({ label, icon, isActive, onClick }) {
  return (
    <div className="rail-btn-wrapper">
      <button
        onClick={onClick}
        className={`rail-btn ${isActive ? 'rail-btn--active' : ''}`}
        title={label}
      >
        {isActive && <span className="rail-active-bar" />}
        {icon}
      </button>
      <span className="rail-tooltip">{label}</span>
    </div>
  );
}
