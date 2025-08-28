// Notification System for GeoWeld Resort Processor
const { useState, useEffect, createContext, useContext } = React;

// Notification Context
const NotificationContext = createContext();

// Notification types
const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

// Notification Hook
const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

// Individual Notification Component
const NotificationItem = ({ notification, onDismiss }) => {
  useEffect(() => {
    if (notification.autoClose) {
      const timer = setTimeout(() => {
        onDismiss(notification.id);
      }, notification.duration || 5000);
      return () => clearTimeout(timer);
    }
  }, [notification, onDismiss]);

  const typeStyles = {
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
  };

  const iconMap = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  return (
    <div 
      className={`p-4 border rounded-lg shadow-md transition-all duration-300 ${typeStyles[notification.type]} animate-slide-in`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 mr-3 text-lg">
          {iconMap[notification.type]}
        </div>
        <div className="flex-1">
          {notification.title && (
            <h4 className="font-medium mb-1">{notification.title}</h4>
          )}
          <p className="text-sm">{notification.message}</p>
        </div>
        <button
          onClick={() => onDismiss(notification.id)}
          className="flex-shrink-0 ml-3 text-lg hover:opacity-70 transition-opacity"
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
    </div>
  );
};

// Notifications Container Component
const NotificationContainer = ({ notifications, onDismiss }) => {
  if (notifications.length === 0) return null;

  return (
    <div 
      className="fixed top-4 right-4 z-50 space-y-2 max-w-md w-full"
      aria-live="polite"
      aria-label="Notifications"
    >
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
};

// Notification Provider Component
const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = (notification) => {
    const id = Date.now() + Math.random();
    const newNotification = {
      id,
      autoClose: true,
      duration: 5000,
      ...notification
    };
    setNotifications(prev => [...prev, newNotification]);
    return id;
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  // Convenience methods for different types
  const showSuccess = (message, title = null, options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.SUCCESS,
      title,
      message,
      ...options
    });
  };

  const showError = (message, title = null, options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.ERROR,
      title,
      message,
      autoClose: false, // Errors should not auto-close by default
      ...options
    });
  };

  const showWarning = (message, title = null, options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.WARNING,
      title,
      message,
      ...options
    });
  };

  const showInfo = (message, title = null, options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.INFO,
      title,
      message,
      ...options
    });
  };

  const contextValue = {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    showSuccess,
    showError,
    showWarning,
    showInfo
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <NotificationContainer 
        notifications={notifications} 
        onDismiss={removeNotification} 
      />
    </NotificationContext.Provider>
  );
};

// Confirmation Dialog Hook (replaces window.confirm)
const useConfirmDialog = () => {
  const { showWarning } = useNotifications();
  
  const confirm = (message, title = 'Confirm Action') => {
    return new Promise((resolve) => {
      // Create a custom confirmation notification
      const confirmId = showWarning(
        `${message}\n\nThis action cannot be undone.`,
        title,
        {
          autoClose: false,
          actions: [
            {
              label: 'Cancel',
              onClick: () => resolve(false)
            },
            {
              label: 'Confirm',
              onClick: () => resolve(true),
              variant: 'danger'
            }
          ]
        }
      );
    });
  };

  return { confirm };
};

// Add custom CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slide-in {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  .animate-slide-in {
    animation: slide-in 0.3s ease-out forwards;
  }
`;
document.head.appendChild(style);

// Export everything
window.NotificationSystem = {
  NotificationProvider,
  useNotifications,
  useConfirmDialog,
  NOTIFICATION_TYPES
};