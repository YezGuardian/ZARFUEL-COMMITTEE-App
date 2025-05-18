import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard,
  CalendarDays,
  FileText,
  DollarSign,
  Shield,
  FileArchive,
  Contact,
  Users,
  CalendarClock,
  MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
  isOpen: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
  const { canViewPage, isAdmin, isSuperAdmin } = useAuth();
  
  const navigation = [
    { name: 'Overview', path: '/dashboard', icon: LayoutDashboard, page: 'dashboard' },
    { name: 'Phases & Tasks', path: '/tasks', icon: FileText, page: 'tasks' },
    { name: 'Calendar', path: '/calendar', icon: CalendarDays, page: 'calendar' },
    { name: 'Meetings', path: '/meetings', icon: CalendarClock, page: 'meetings' },
    { name: 'Budget', path: '/budget', icon: DollarSign, page: 'budget' },
    { name: 'Risk Management', path: '/risks', icon: Shield, page: 'risks' },
    { name: 'Document Repository', path: '/documents', icon: FileArchive, page: 'documents' },
    { name: 'Contact Directory', path: '/contacts', icon: Contact, page: 'contacts' },
    { name: 'Committee Forum', path: '/forum', icon: MessageSquare, page: 'forum' },
  ];

  const adminNavigation = [
    { name: 'User Management', path: '/users', icon: Users, page: 'users', requiresAdmin: true },
  ];
  
  // Filter navigation based on user permissions
  const filteredNavigation = navigation.filter(item => canViewPage(item.page));
  const filteredAdminNavigation = adminNavigation.filter(item => canViewPage(item.page));
  
  const allNavItems = [...filteredNavigation, ...filteredAdminNavigation];

  // Close sidebar on mobile/tablet after navigation
  const handleNavClick = () => {
    if (window.innerWidth < 1024) {
      const event = new CustomEvent('closeSidebar');
      window.dispatchEvent(event);
    }
  };
  // Close sidebar when clicking the backdrop
  const handleBackdropClick = () => {
    const event = new CustomEvent('closeSidebar');
    window.dispatchEvent(event);
  };

  return (
    <>
      {/* Backdrop for mobile/tablet */}
      {isOpen && (
        <div
          className="fixed inset-0 z-10 bg-black bg-opacity-40 md:hidden"
          onClick={handleBackdropClick}
        />
      )}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-20 w-64 bg-sidebar transform transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0'
        )}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-center border-b border-sidebar-border">
          <h1 className="text-xl font-bold text-sidebar-accent">ZARFUEL TRUCKSTOP</h1>
        </div>
        
        {/* Navigation Links */}
        <nav className="py-6 px-3">
          <ul className="space-y-1">
            {allNavItems.map((item) => (
              <li key={item.name}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-zarfuel-gold text-zarfuel-blue'
                        : 'text-sidebar-foreground hover:bg-sidebar-border'
                    )
                  }
                  end
                  onClick={handleNavClick}
                >
                  <item.icon className="mr-3 h-5 w-5 dark:text-primary" />
                  {item.name}
                </NavLink>
              </li>
            ))}
            {/* Deletion Logs link for super admins only */}
            {isSuperAdmin() && (
              <li key="deletion-logs">
                <NavLink
                  to="/admin/deletion-logs"
                  className={({ isActive }) =>
                    cn(
                      'flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-zarfuel-gold text-zarfuel-blue'
                        : 'text-sidebar-foreground hover:bg-sidebar-border'
                    )
                  }
                  end
                  onClick={handleNavClick}
                >
                  <FileArchive className="mr-3 h-5 w-5 dark:text-primary" />
                  Deletion Logs
                </NavLink>
              </li>
            )}
          </ul>
        </nav>
        
        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="border-t border-sidebar-border pt-4 text-center">
            <div className="text-xs text-sidebar-foreground/70">
              © 2025 ZARSOM GROUP - Designed by <a href="https://www.whitepaperconcepts.co.za" target="_blank" rel="noopener noreferrer" className="underline">WHITE PAPER CONCEPTS</a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
