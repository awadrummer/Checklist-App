const { useState, useEffect, useCallback } = React;

// IndexedDB helper functions
const DB_NAME = 'ChecklistDB';
const DB_VERSION = 2;

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('checklists')) {
        const checklistStore = db.createObjectStore('checklists', { keyPath: 'id' });
        checklistStore.createIndex('name', 'name', { unique: false });
        checklistStore.createIndex('color', 'color', { unique: false });
        checklistStore.createIndex('order', 'order', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('items')) {
        const itemStore = db.createObjectStore('items', { keyPath: 'id' });
        itemStore.createIndex('checklistId', 'checklistId', { unique: false });
        itemStore.createIndex('dueDate', 'dueDate', { unique: false });
        itemStore.createIndex('order', 'order', { unique: false });
      }
      
      // Handle database upgrades
      if (event.oldVersion < 2) {
        // Add order field to existing records
        const transaction = event.target.transaction;
        
        if (db.objectStoreNames.contains('checklists')) {
          const checklistStore = transaction.objectStore('checklists');
          if (!checklistStore.indexNames.contains('order')) {
            checklistStore.createIndex('order', 'order', { unique: false });
          }
        }
        
        if (db.objectStoreNames.contains('items')) {
          const itemStore = transaction.objectStore('items');
          if (!itemStore.indexNames.contains('order')) {
            itemStore.createIndex('order', 'order', { unique: false });
          }
        }
      }
      
      if (!db.objectStoreNames.contains('archive')) {
        const archiveStore = db.createObjectStore('archive', { keyPath: 'id' });
        archiveStore.createIndex('checklistId', 'checklistId', { unique: false });
        archiveStore.createIndex('completedAt', 'completedAt', { unique: false });
      }
    };
  });
};

const dbOperation = async (storeName, operation, data = null) => {
  const db = await initDB();
  const transaction = db.transaction([storeName], operation === 'get' || operation === 'getAll' ? 'readonly' : 'readwrite');
  const store = transaction.objectStore(storeName);
  
  let request;
  switch (operation) {
    case 'add':
      request = store.add(data);
      break;
    case 'put':
      request = store.put(data);
      break;
    case 'delete':
      request = store.delete(data);
      break;
    case 'get':
      request = store.get(data);
      break;
    case 'getAll':
      request = store.getAll();
      break;
    default:
      throw new Error('Invalid operation');
  }
  
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Utility functions
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleString();
};

const isOverdue = (dueDate) => {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
};

// Notification helper
const requestNotificationPermission = async () => {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
};

const showNotification = (title, options = {}) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification(title, {
      icon: 'icons/icon-192x192.png',
      badge: 'icons/icon-72x72.png',
      ...options
    });
    
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    
    return notification;
  }
};

// Theme context
const ThemeContext = React.createContext();

// Main App Component
const ChecklistApp = () => {
  const [checklists, setChecklists] = useState([]);
  const [items, setItems] = useState([]);
  const [archive, setArchive] = useState([]);
  const [currentView, setCurrentView] = useState('active');
  const [theme, setTheme] = useState('dark');
  const [showNewChecklistModal, setShowNewChecklistModal] = useState(false);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [reminderIntervals, setReminderIntervals] = useState({});
  const [draggedItem, setDraggedItem] = useState(null);
  const [draggedChecklist, setDraggedChecklist] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null);

  // Initialize app
  useEffect(() => {
    const initApp = async () => {
      // Load theme preference
      const savedTheme = localStorage.getItem('theme') || 'dark';
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
      
      // Request notification permission
      await requestNotificationPermission();
      
      // Load data
      await loadData();
      
      // Start reminder checking
      startReminderCheck();
    };
    
    initApp();
  }, []);

  const loadData = async () => {
    try {
      const [checklistsData, itemsData, archiveData] = await Promise.all([
        dbOperation('checklists', 'getAll'),
        dbOperation('items', 'getAll'),
        dbOperation('archive', 'getAll')
      ]);
      
      // Sort by order, fallback to creation date
      const sortedChecklists = (checklistsData || []).sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
      
      const sortedItems = (itemsData || []).sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
      
      setChecklists(sortedChecklists);
      setItems(sortedItems);
      setArchive(archiveData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const createChecklist = async (checklistData) => {
    const newChecklist = {
      id: generateId(),
      name: checklistData.name || checklistData,
      color: checklistData.color || '#4a9eff',
      createdAt: new Date().toISOString()
    };
    
    try {
      await dbOperation('checklists', 'add', newChecklist);
      setChecklists(prev => [...prev, newChecklist]);
      setShowNewChecklistModal(false);
    } catch (error) {
      console.error('Error creating checklist:', error);
    }
  };

  const duplicateChecklist = async (originalChecklist) => {
    const maxOrder = checklists.reduce((max, cl) => Math.max(max, cl.order || 0), 0);
    const newChecklist = {
      ...originalChecklist,
      id: generateId(),
      name: `${originalChecklist.name} (Copy)`,
      order: maxOrder + 1,
      createdAt: new Date().toISOString()
    };
    
    try {
      await dbOperation('checklists', 'add', newChecklist);
      
      // Duplicate all items in the checklist
      const checklistItems = items.filter(item => item.checklistId === originalChecklist.id);
      for (const item of checklistItems) {
        const newItem = {
          ...item,
          id: generateId(),
          checklistId: newChecklist.id,
          completed: false,
          order: item.order,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await dbOperation('items', 'add', newItem);
        setItems(prev => [...prev, newItem]);
        
        // Set up reminder if due date is set
        if (newItem.dueDate) {
          setupReminder(newItem);
        }
      }
      
      setChecklists(prev => [...prev, newChecklist]);
    } catch (error) {
      console.error('Error duplicating checklist:', error);
    }
  };

  const updateChecklist = async (checklistId, updates) => {
    const checklist = checklists.find(cl => cl.id === checklistId);
    if (!checklist) return;
    
    const updatedChecklist = {
      ...checklist,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    try {
      await dbOperation('checklists', 'put', updatedChecklist);
      setChecklists(prev => prev.map(cl => cl.id === checklistId ? updatedChecklist : cl));
    } catch (error) {
      console.error('Error updating checklist:', error);
    }
  };

  const deleteChecklist = async (checklistId) => {
    if (!confirm('Are you sure you want to delete this checklist and all its items?')) {
      return;
    }
    
    try {
      // Delete checklist
      await dbOperation('checklists', 'delete', checklistId);
      
      // Delete all items in checklist
      const checklistItems = items.filter(item => item.checklistId === checklistId);
      for (const item of checklistItems) {
        await dbOperation('items', 'delete', item.id);
        if (reminderIntervals[item.id]) {
          clearInterval(reminderIntervals[item.id]);
        }
      }
      
      // Delete archived items
      const archivedItems = archive.filter(item => item.checklistId === checklistId);
      for (const item of archivedItems) {
        await dbOperation('archive', 'delete', item.id);
      }
      
      setChecklists(prev => prev.filter(cl => cl.id !== checklistId));
      setItems(prev => prev.filter(item => item.checklistId !== checklistId));
      setArchive(prev => prev.filter(item => item.checklistId !== checklistId));
      
      // Clean up reminder intervals
      setReminderIntervals(prev => {
        const newIntervals = { ...prev };
        checklistItems.forEach(item => {
          if (newIntervals[item.id]) {
            clearInterval(newIntervals[item.id]);
            delete newIntervals[item.id];
          }
        });
        return newIntervals;
      });
    } catch (error) {
      console.error('Error deleting checklist:', error);
    }
  };

  const createOrUpdateItem = async (itemData) => {
    const isEditing = !!editingItem;
    const checklistItems = items.filter(item => item.checklistId === selectedChecklist);
    const maxOrder = isEditing ? editingItem.order : checklistItems.reduce((max, item) => Math.max(max, item.order || 0), 0) + 1;
    
    const item = {
      id: isEditing ? editingItem.id : generateId(),
      checklistId: selectedChecklist,
      title: itemData.title,
      notes: itemData.notes || '',
      dueDate: itemData.dueDate || null,
      repeatFrequency: itemData.repeatFrequency || 'none',
      customInterval: itemData.customInterval || null,
      reminderRepeat: itemData.reminderRepeat || 1,
      autoDismissAfter: itemData.autoDismissAfter || null,
      completed: isEditing ? editingItem.completed : false,
      order: maxOrder,
      createdAt: isEditing ? editingItem.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    try {
      await dbOperation('items', isEditing ? 'put' : 'add', item);
      
      if (isEditing) {
        setItems(prev => prev.map(i => i.id === item.id ? item : i));
      } else {
        setItems(prev => [...prev, item]);
      }
      
      // Set up reminder if due date is set
      if (item.dueDate) {
        setupReminder(item);
      }
      
      setShowNewItemModal(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving item:', error);
    }
  };

  const toggleItemComplete = async (itemId) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    // Check if item has a future due date and warn user
    if (!item.completed && item.dueDate) {
      const dueTime = new Date(item.dueDate);
      const now = new Date();
      if (dueTime > now) {
        const confirmed = confirm(`This item isn't due until ${formatDate(item.dueDate)}. Are you sure you want to mark it complete?`);
        if (!confirmed) return;
      }
    }
    
    try {
      if (!item.completed) {
        // Mark as completed and move to archive
        const completedItem = {
          ...item,
          completed: true,
          completedAt: new Date().toISOString()
        };
        
        await dbOperation('archive', 'add', completedItem);
        await dbOperation('items', 'delete', itemId);
        
        setItems(prev => prev.filter(i => i.id !== itemId));
        setArchive(prev => [...prev, completedItem]);
        
        // Clear reminder
        if (reminderIntervals[itemId]) {
          clearInterval(reminderIntervals[itemId]);
          setReminderIntervals(prev => {
            const newIntervals = { ...prev };
            delete newIntervals[itemId];
            return newIntervals;
          });
        }
        
        // Handle repeat
        if (item.repeatFrequency !== 'none') {
          const nextDueDate = calculateNextDueDate(item.dueDate, item.repeatFrequency, item.customInterval);
          if (nextDueDate) {
            const newItem = {
              ...item,
              id: generateId(),
              dueDate: nextDueDate,
              completed: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            
            await dbOperation('items', 'add', newItem);
            setItems(prev => [...prev, newItem]);
            setupReminder(newItem);
          }
        }
      }
    } catch (error) {
      console.error('Error toggling item complete:', error);
    }
  };

  const deleteItem = async (itemId) => {
    try {
      await dbOperation('items', 'delete', itemId);
      setItems(prev => prev.filter(i => i.id !== itemId));
      
      // Clear reminder
      if (reminderIntervals[itemId]) {
        clearInterval(reminderIntervals[itemId]);
        setReminderIntervals(prev => {
          const newIntervals = { ...prev };
          delete newIntervals[itemId];
          return newIntervals;
        });
      }
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const duplicateItem = async (originalItem) => {
    const checklistItems = items.filter(item => item.checklistId === originalItem.checklistId);
    const maxOrder = checklistItems.reduce((max, item) => Math.max(max, item.order || 0), 0);
    
    const newItem = {
      ...originalItem,
      id: generateId(),
      title: `${originalItem.title} (Copy)`,
      completed: false,
      order: maxOrder + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    try {
      await dbOperation('items', 'add', newItem);
      setItems(prev => [...prev, newItem]);
      
      // Set up reminder if due date is set
      if (newItem.dueDate) {
        setupReminder(newItem);
      }
    } catch (error) {
      console.error('Error duplicating item:', error);
    }
  };

  const calculateNextDueDate = (currentDueDate, frequency, customInterval) => {
    const current = new Date(currentDueDate);
    
    switch (frequency) {
      case 'daily':
        current.setDate(current.getDate() + 1);
        break;
      case 'weekly':
        current.setDate(current.getDate() + 7);
        break;
      case 'custom':
        if (customInterval) {
          current.setDate(current.getDate() + parseInt(customInterval));
        }
        break;
      default:
        return null;
    }
    
    return current.toISOString();
  };

  const setupReminder = (item) => {
    if (!item.dueDate) return;
    
    const dueTime = new Date(item.dueDate).getTime();
    const now = Date.now();
    
    if (dueTime <= now) {
      // Already past due, show notification immediately
      showNotification(`Overdue: ${item.title}`, {
        body: item.notes || 'This item is overdue',
        tag: item.id,
        requireInteraction: true
      });
      return;
    }
    
    // Set up timer for due time
    const delay = dueTime - now;
    const timerId = setTimeout(() => {
      showNotification(`Due: ${item.title}`, {
        body: item.notes || 'This item is due now',
        tag: item.id,
        requireInteraction: true
      });
      
      // Set up repeating reminders if specified
      if (item.reminderRepeat > 1) {
        let repeatCount = 1;
        const repeatInterval = setInterval(() => {
          if (repeatCount >= item.reminderRepeat) {
            clearInterval(repeatInterval);
            
            // Auto-dismiss if specified
            if (item.autoDismissAfter) {
              setTimeout(() => {
                // Check if item still exists and auto-archive it
                const currentItem = items.find(i => i.id === item.id);
                if (currentItem && !currentItem.completed) {
                  toggleItemComplete(item.id);
                }
              }, item.autoDismissAfter * 60 * 1000); // Convert minutes to milliseconds
            }
            return;
          }
          
          showNotification(`Reminder: ${item.title}`, {
            body: item.notes || `Reminder ${repeatCount + 1} of ${item.reminderRepeat}`,
            tag: item.id,
            requireInteraction: true
          });
          
          repeatCount++;
        }, 5 * 60 * 1000); // Repeat every 5 minutes
        
        setReminderIntervals(prev => ({
          ...prev,
          [item.id]: repeatInterval
        }));
      }
    }, delay);
    
    setReminderIntervals(prev => ({
      ...prev,
      [item.id]: timerId
    }));
  };

  const startReminderCheck = () => {
    // Check for reminders every minute
    const interval = setInterval(() => {
      items.forEach(item => {
        if (item.dueDate && !item.completed && isOverdue(item.dueDate)) {
          if (!reminderIntervals[item.id]) {
            setupReminder(item);
          }
        }
      });
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  };

  const getChecklistStats = (checklistId) => {
    const checklistItems = items.filter(item => item.checklistId === checklistId);
    const completedItems = archive.filter(item => item.checklistId === checklistId);
    const overdueItems = checklistItems.filter(item => isOverdue(item.dueDate));
    
    return {
      total: checklistItems.length,
      completed: completedItems.length,
      overdue: overdueItems.length
    };
  };

  // Drag and Drop Functions
  const handleChecklistDragStart = (e, checklist) => {
    setDraggedChecklist(checklist);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  };

  const handleChecklistDragOver = (e, targetChecklist) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget(`checklist-${targetChecklist.id}`);
  };

  const handleChecklistDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverTarget(null);
    }
  };

  const handleChecklistDrop = async (e, targetChecklist) => {
    e.preventDefault();
    setDragOverTarget(null);
    
    if (!draggedChecklist || draggedChecklist.id === targetChecklist.id) {
      setDraggedChecklist(null);
      return;
    }

    const sourceIndex = checklists.findIndex(cl => cl.id === draggedChecklist.id);
    const targetIndex = checklists.findIndex(cl => cl.id === targetChecklist.id);
    
    if (sourceIndex === -1 || targetIndex === -1) return;

    // Reorder checklists
    const newChecklists = [...checklists];
    const [movedChecklist] = newChecklists.splice(sourceIndex, 1);
    newChecklists.splice(targetIndex, 0, movedChecklist);
    
    // Update order values
    const updatedChecklists = newChecklists.map((checklist, index) => ({
      ...checklist,
      order: index + 1
    }));
    
    try {
      // Update all checklists in database
      for (const checklist of updatedChecklists) {
        await dbOperation('checklists', 'put', checklist);
      }
      
      setChecklists(updatedChecklists);
    } catch (error) {
      console.error('Error reordering checklists:', error);
    }
    
    setDraggedChecklist(null);
  };

  const handleItemDragStart = (e, item) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  };

  const handleItemDragOver = (e, targetItem, targetChecklistId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (targetItem) {
      setDragOverTarget(`item-${targetItem.id}`);
    } else {
      setDragOverTarget(`checklist-drop-${targetChecklistId}`);
    }
  };

  const handleItemDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverTarget(null);
    }
  };

  const handleItemDrop = async (e, targetItem, targetChecklistId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    
    if (!draggedItem) {
      setDraggedItem(null);
      return;
    }

    const sourceChecklistId = draggedItem.checklistId;
    const finalTargetChecklistId = targetChecklistId || (targetItem ? targetItem.checklistId : sourceChecklistId);
    
    if (targetItem && draggedItem.id === targetItem.id) {
      setDraggedItem(null);
      return;
    }

    try {
      if (sourceChecklistId !== finalTargetChecklistId) {
        // Moving between checklists
        const targetItems = items.filter(item => item.checklistId === finalTargetChecklistId);
        const newOrder = targetItem 
          ? targetItem.order 
          : targetItems.reduce((max, item) => Math.max(max, item.order || 0), 0) + 1;
        
        const updatedItem = {
          ...draggedItem,
          checklistId: finalTargetChecklistId,
          order: newOrder,
          updatedAt: new Date().toISOString()
        };
        
        await dbOperation('items', 'put', updatedItem);
        setItems(prev => prev.map(item => item.id === draggedItem.id ? updatedItem : item));
        
        // Reorder items in target checklist if needed
        if (targetItem) {
          const itemsToReorder = items
            .filter(item => item.checklistId === finalTargetChecklistId && item.id !== draggedItem.id)
            .filter(item => item.order >= newOrder)
            .map(item => ({ ...item, order: item.order + 1 }));
          
          for (const item of itemsToReorder) {
            await dbOperation('items', 'put', item);
          }
          
          setItems(prev => prev.map(item => {
            const reordered = itemsToReorder.find(r => r.id === item.id);
            return reordered || item;
          }));
        }
      } else {
        // Reordering within same checklist
        const checklistItems = items.filter(item => item.checklistId === sourceChecklistId);
        const sourceIndex = checklistItems.findIndex(item => item.id === draggedItem.id);
        const targetIndex = targetItem ? checklistItems.findIndex(item => item.id === targetItem.id) : checklistItems.length;
        
        if (sourceIndex === -1 || sourceIndex === targetIndex) {
          setDraggedItem(null);
          return;
        }
        
        // Reorder items
        const newItems = [...checklistItems];
        const [movedItem] = newItems.splice(sourceIndex, 1);
        newItems.splice(targetIndex > sourceIndex ? targetIndex - 1 : targetIndex, 0, movedItem);
        
        // Update order values
        const updatedItems = newItems.map((item, index) => ({
          ...item,
          order: index + 1,
          updatedAt: new Date().toISOString()
        }));
        
        // Update all items in database
        for (const item of updatedItems) {
          await dbOperation('items', 'put', item);
        }
        
        setItems(prev => prev.map(item => {
          const updated = updatedItems.find(u => u.id === item.id);
          return updated || item;
        }));
      }
    } catch (error) {
      console.error('Error reordering items:', error);
    }
    
    setDraggedItem(null);
  };

  const handleChecklistDropZone = (e, checklistId) => {
    handleItemDrop(e, null, checklistId);
  };

  return (
    <div className="app">
      <header className="header">
        <h1>📋 Checklist App</h1>
        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
      </header>

      <div className="tab-container">
        <div className="tab-buttons">
          <button 
            className={`tab-button ${currentView === 'active' ? 'active' : ''}`}
            onClick={() => setCurrentView('active')}
          >
            Active Lists
          </button>
          <button 
            className={`tab-button ${currentView === 'archive' ? 'active' : ''}`}
            onClick={() => setCurrentView('archive')}
          >
            Archive
          </button>
        </div>

        {currentView === 'active' && (
          <div>
            <button 
              className="btn" 
              onClick={() => setShowNewChecklistModal(true)}
            >
              ➕ New Checklist
            </button>

            <div className="checklist-list">
              {checklists.length === 0 ? (
                <div className="empty-state">
                  <h3>No checklists yet</h3>
                  <p>Create your first checklist to get started!</p>
                </div>
              ) : (
                checklists.map(checklist => {
                  const stats = getChecklistStats(checklist.id);
                  const checklistItems = items.filter(item => item.checklistId === checklist.id);
                  
                  return (
                    <div 
                      key={checklist.id} 
                      className={`checklist-card ${
                        dragOverTarget === `checklist-${checklist.id}` ? 'drag-over' : ''
                      }`}
                      draggable
                      onDragStart={(e) => handleChecklistDragStart(e, checklist)}
                      onDragOver={(e) => handleChecklistDragOver(e, checklist)}
                      onDragLeave={handleChecklistDragLeave}
                      onDrop={(e) => handleChecklistDrop(e, checklist)}
                    >
                      <div className="checklist-header">
                        <div>
                          <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px'}}>
                            <div 
                              className="color-indicator" 
                              style={{backgroundColor: checklist.color || '#4a9eff'}}
                            ></div>
                            <h3 className="checklist-title">{checklist.name}</h3>
                          </div>
                          <div className="checklist-stats">
                            {stats.total} items • {stats.completed} completed
                            {stats.overdue > 0 && <span style={{color: 'var(--danger)'}}> • {stats.overdue} overdue</span>}
                          </div>
                        </div>
                        <div className="checklist-actions">
                          <button 
                            className="btn btn-small"
                            onClick={() => {
                              setSelectedChecklist(checklist.id);
                              setShowNewItemModal(true);
                            }}
                          >
                            ➕
                          </button>
                          <button 
                            className="btn btn-small btn-secondary"
                            onClick={() => duplicateChecklist(checklist)}
                            title="Duplicate Checklist"
                          >
                            📋
                          </button>
                          <ColorPicker 
                            color={checklist.color || '#4a9eff'}
                            onChange={(color) => updateChecklist(checklist.id, { color })}
                          />
                          <button 
                            className="btn btn-small btn-danger"
                            onClick={() => deleteChecklist(checklist.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      <div 
                        className={`checklist-items ${dragOverTarget === `checklist-drop-${checklist.id}` ? 'drag-over-drop-zone' : ''}`}
                        onDragOver={(e) => handleItemDragOver(e, null, checklist.id)}
                        onDragLeave={handleItemDragLeave}
                        onDrop={(e) => handleChecklistDropZone(e, checklist.id)}
                      >
                        {checklistItems.length === 0 ? (
                          <div className="empty-state" style={{padding: '20px'}}>
                            <p>No items in this checklist</p>
                            <p style={{fontSize: '0.5rem', marginTop: '5px'}}>Drop items here</p>
                          </div>
                        ) : (
                          checklistItems.map(item => (
                            <ChecklistItem 
                              key={item.id} 
                              item={item}
                              onToggleComplete={toggleItemComplete}
                              onEdit={(item) => {
                                setEditingItem(item);
                                setSelectedChecklist(item.checklistId);
                                setShowNewItemModal(true);
                              }}
                              onDelete={deleteItem}
                              onDuplicate={duplicateItem}
                              onDragStart={handleItemDragStart}
                              onDragOver={handleItemDragOver}
                              onDragLeave={handleItemDragLeave}
                              onDrop={handleItemDrop}
                              isDraggedOver={dragOverTarget === `item-${item.id}`}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {currentView === 'archive' && (
          <ArchiveView archive={archive} checklists={checklists} />
        )}
      </div>

      {showNewChecklistModal && (
        <NewChecklistModal 
          onSave={createChecklist}
          onClose={() => setShowNewChecklistModal(false)}
        />
      )}

      {showNewItemModal && (
        <NewItemModal 
          item={editingItem}
          onSave={createOrUpdateItem}
          onClose={() => {
            setShowNewItemModal(false);
            setEditingItem(null);
          }}
        />
      )}
    </div>
  );
};

// Color Picker Component
const ColorPicker = ({ color, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const colors = [
    '#4a9eff', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', 
    '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#6366f1'
  ];
  
  return (
    <div className="color-picker">
      <button 
        className="color-picker-trigger"
        style={{backgroundColor: color}}
        onClick={() => setIsOpen(!isOpen)}
        title="Change Color"
      >
        🎨
      </button>
      {isOpen && (
        <div className="color-picker-dropdown">
          {colors.map(c => (
            <button
              key={c}
              className="color-option"
              style={{backgroundColor: c}}
              onClick={() => {
                onChange(c);
                setIsOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Checklist Item Component
const ChecklistItem = ({ 
  item, 
  onToggleComplete, 
  onEdit, 
  onDelete, 
  onDuplicate, 
  onDragStart, 
  onDragOver, 
  onDragLeave, 
  onDrop, 
  isDraggedOver 
}) => {
  const isItemOverdue = isOverdue(item.dueDate);
  
  return (
    <div 
      className={`checkbox-item ${item.completed ? 'completed' : ''} ${isDraggedOver ? 'drag-over' : ''}`}
      draggable
      onDragStart={(e) => onDragStart(e, item)}
      onDragOver={(e) => onDragOver(e, item)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, item)}
    >
      <input 
        type="checkbox" 
        className="checkbox"
        checked={item.completed}
        onChange={() => onToggleComplete(item.id)}
      />
      
      <div className="item-content">
        <div className={`item-title ${item.completed ? 'completed' : ''}`}>
          {item.title}
        </div>
        
        {item.notes && (
          <div className="item-notes">{item.notes}</div>
        )}
        
        <div className="item-meta">
          {item.dueDate && (
            <span className={`meta-tag ${isItemOverdue ? 'overdue' : ''}`} style={{
              backgroundColor: isItemOverdue ? 'var(--danger)' : 'var(--bg-tertiary)',
              color: isItemOverdue ? 'white' : 'var(--text-muted)'
            }}>
              📅 {formatDate(item.dueDate)}
            </span>
          )}
          
          {item.repeatFrequency !== 'none' && (
            <span className="meta-tag">
              🔄 {item.repeatFrequency === 'custom' ? `Every ${item.customInterval} days` : item.repeatFrequency}
            </span>
          )}
          
          {item.reminderRepeat > 1 && (
            <span className="meta-tag">
              🔔 {item.reminderRepeat} reminders
            </span>
          )}
        </div>
      </div>
      
      <div className="item-actions">
        <button 
          className="btn btn-small btn-secondary"
          onClick={() => onEdit(item)}
          title="Edit Item"
        >
          ✏️
        </button>
        <button 
          className="btn btn-small btn-secondary"
          onClick={() => onDuplicate(item)}
          title="Duplicate Item"
        >
          📋
        </button>
        <button 
          className="btn btn-small btn-danger"
          onClick={() => onDelete(item.id)}
          title="Delete Item"
        >
          🗑️
        </button>
      </div>
    </div>
  );
};

// Archive View Component
const ArchiveView = ({ archive, checklists }) => {
  const getChecklistName = (checklistId) => {
    const checklist = checklists.find(cl => cl.id === checklistId);
    return checklist ? checklist.name : 'Unknown Checklist';
  };
  
  const sortedArchive = [...archive].sort((a, b) => 
    new Date(b.completedAt) - new Date(a.completedAt)
  );
  
  return (
    <div>
      {sortedArchive.length === 0 ? (
        <div className="empty-state">
          <h3>No completed items yet</h3>
          <p>Completed items will appear here</p>
        </div>
      ) : (
        <div>
          {sortedArchive.map(item => (
            <div key={item.id} className="checkbox-item completed">
              <input 
                type="checkbox" 
                className="checkbox"
                checked={true}
                disabled
              />
              
              <div className="item-content">
                <div className="item-title completed">{item.title}</div>
                
                {item.notes && (
                  <div className="item-notes">{item.notes}</div>
                )}
                
                <div className="item-meta">
                  <span className="meta-tag">
                    📋 {getChecklistName(item.checklistId)}
                  </span>
                  <span className="meta-tag">
                    ✅ Completed {formatDate(item.completedAt)}
                  </span>
                  {item.dueDate && (
                    <span className="meta-tag">
                      📅 Was due {formatDate(item.dueDate)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// New Checklist Modal
const NewChecklistModal = ({ onSave, onClose }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#4a9eff');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSave({ name: name.trim(), color });
      setName('');
      setColor('#4a9eff');
    }
  };
  
  return (
    <div className="modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">New Checklist</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Checklist Name</label>
            <input 
              type="text" 
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter checklist name"
              autoFocus
              required
            />
          </div>
          
          <div className="input-group">
            <label>Color</label>
            <ColorPicker color={color} onChange={setColor} />
          </div>
          
          <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn">
              Create Checklist
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// New Item Modal
const NewItemModal = ({ item, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    title: item?.title || '',
    notes: item?.notes || '',
    dueDate: item?.dueDate ? new Date(item.dueDate).toISOString().slice(0, 16) : '',
    repeatFrequency: item?.repeatFrequency || 'none',
    customInterval: item?.customInterval || '',
    reminderRepeat: item?.reminderRepeat || 1,
    autoDismissAfter: item?.autoDismissAfter || ''
  });
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.title.trim()) {
      const data = {
        ...formData,
        title: formData.title.trim(),
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
        customInterval: formData.customInterval ? parseInt(formData.customInterval) : null,
        reminderRepeat: parseInt(formData.reminderRepeat),
        autoDismissAfter: formData.autoDismissAfter ? parseInt(formData.autoDismissAfter) : null
      };
      onSave(data);
    }
  };
  
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  return (
    <div className="modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">{item ? 'Edit Item' : 'New Item'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Title *</label>
            <input 
              type="text" 
              className="input"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Enter item title"
              autoFocus
              required
            />
          </div>
          
          <div className="input-group">
            <label>Notes</label>
            <textarea 
              className="textarea"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Optional notes"
            />
          </div>
          
          <div className="input-group">
            <label>Due Date & Time</label>
            <input 
              type="datetime-local" 
              className="input"
              value={formData.dueDate}
              onChange={(e) => handleChange('dueDate', e.target.value)}
            />
          </div>
          
          <div className="form-row">
            <div className="input-group">
              <label>Repeat Frequency</label>
              <select 
                className="select"
                value={formData.repeatFrequency}
                onChange={(e) => handleChange('repeatFrequency', e.target.value)}
              >
                <option value="none">No Repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="custom">Custom Interval</option>
              </select>
            </div>
            
            {formData.repeatFrequency === 'custom' && (
              <div className="input-group">
                <label>Days Interval</label>
                <input 
                  type="number" 
                  className="input"
                  value={formData.customInterval}
                  onChange={(e) => handleChange('customInterval', e.target.value)}
                  placeholder="Days"
                  min="1"
                />
              </div>
            )}
          </div>
          
          <div className="form-row">
            <div className="input-group">
              <label>Reminder Repeats</label>
              <input 
                type="number" 
                className="input"
                value={formData.reminderRepeat}
                onChange={(e) => handleChange('reminderRepeat', e.target.value)}
                min="1"
                max="10"
              />
            </div>
            
            <div className="input-group">
              <label>Auto-dismiss After (minutes)</label>
              <input 
                type="number" 
                className="input"
                value={formData.autoDismissAfter}
                onChange={(e) => handleChange('autoDismissAfter', e.target.value)}
                placeholder="Optional"
                min="1"
              />
            </div>
          </div>
          
          <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn">
              {item ? 'Update Item' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Render the app
ReactDOM.render(<ChecklistApp />, document.getElementById('app'));