const { useState, useEffect, useCallback } = React;

// IndexedDB helper functions
const DB_NAME = 'ChecklistDB';
const DB_VERSION = 1;

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
      }
      
      if (!db.objectStoreNames.contains('items')) {
        const itemStore = db.createObjectStore('items', { keyPath: 'id' });
        itemStore.createIndex('checklistId', 'checklistId', { unique: false });
        itemStore.createIndex('dueDate', 'dueDate', { unique: false });
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
      
      setChecklists(checklistsData || []);
      setItems(itemsData || []);
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

  const createChecklist = async (name) => {
    const newChecklist = {
      id: generateId(),
      name,
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
                    <div key={checklist.id} className="checklist-card">
                      <div className="checklist-header">
                        <div>
                          <h3 className="checklist-title">{checklist.name}</h3>
                          <div className="checklist-stats">
                            {stats.total} items • {stats.completed} completed
                            {stats.overdue > 0 && <span style={{color: 'var(--danger)'}}> • {stats.overdue} overdue</span>}
                          </div>
                        </div>
                        <div style={{display: 'flex', gap: '10px'}}>
                          <button 
                            className="btn btn-small"
                            onClick={() => {
                              setSelectedChecklist(checklist.id);
                              setShowNewItemModal(true);
                            }}
                          >
                            ➕ Add Item
                          </button>
                          <button 
                            className="btn btn-small btn-danger"
                            onClick={() => deleteChecklist(checklist.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      <div>
                        {checklistItems.length === 0 ? (
                          <div className="empty-state" style={{padding: '20px'}}>
                            <p>No items in this checklist</p>
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

// Checklist Item Component
const ChecklistItem = ({ item, onToggleComplete, onEdit, onDelete }) => {
  const isItemOverdue = isOverdue(item.dueDate);
  
  return (
    <div className={`checkbox-item ${item.completed ? 'completed' : ''}`}>
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
        >
          ✏️
        </button>
        <button 
          className="btn btn-small btn-danger"
          onClick={() => onDelete(item.id)}
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
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
      setName('');
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