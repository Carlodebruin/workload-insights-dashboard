'use client';

import React, { useState, useRef, useEffect } from 'react';
// ... rest of the file
import { User, NewUserData, Geofence, NewGeofenceData, Category, NewActivityData, Activity, ActivityStatus } from '../types';
import { PlusCircle, Edit, Trash2, User as UserIcon, MapPin, Tag } from 'lucide-react';
import Spinner from '../components/Spinner';
import UserFormModal from '../components/UserFormModal';
import { useToast } from '../hooks/useToast';
import { useGeofences } from '../hooks/useGeofences';
import GeofenceFormModal from '../components/GeofenceFormModal';
import WhatsAppSimulator from '../components/WhatsAppSimulator';
import { parseWhatsAppMessage } from '../lib/ai-parser';
import DynamicGeofenceMap from '../components/dynamic/DynamicGeofenceMap';

interface AdminPageProps {
  users: User[];
  categories: Category[];
  addUser: (userData: NewUserData) => Promise<User>;
  updateUser: (userId: string, updatedData: Partial<NewUserData>) => Promise<User>;
  deleteUser: (userId: string) => Promise<void>;
  addCategory: (name: string) => Promise<Category>;
  deleteCategory: (categoryId: string) => Promise<void>;
  addActivity: (activityData: NewActivityData) => Promise<Activity>;
  dataLoading: boolean;
}

const AdminPage: React.FC<AdminPageProps> = ({
  users,
  categories,
  addUser,
  updateUser,
  deleteUser,
  addCategory,
  deleteCategory,
  addActivity,
  dataLoading,
}) => {
  // Client-side check
  const [isClient, setIsClient] = useState(false);
  
  // User Management State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const userModalTriggerRef = useRef<HTMLElement | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Geofence Management Hooks & State
  const { geofences, addGeofence, updateGeofence, deleteGeofence, loading: geofencesLoading } = useGeofences();
  const [isGeofenceModalOpen, setIsGeofenceModalOpen] = useState(false);
  const [geofenceToEdit, setGeofenceToEdit] = useState<Geofence | null>(null);
  const [pendingShape, setPendingShape] = useState<NewGeofenceData | null>(null);
  
  const { addToast } = useToast();
  const loading = dataLoading || geofencesLoading;

  // Client-side only initialization
  useEffect(() => {
    setIsClient(true);
  }, []);

  // --- User Management Handlers ---
  const handleAddUser = () => {
    userModalTriggerRef.current = document.activeElement as HTMLElement;
    setUserToEdit(null);
    setIsUserModalOpen(true);
  };

  const handleEditUser = (user: User) => {
    userModalTriggerRef.current = document.activeElement as HTMLElement;
    setUserToEdit(user);
    setIsUserModalOpen(true);
  };
  
  const handleDeleteUser = (userId: string) => {
      if (!isClient) return;
      
      if (typeof window !== 'undefined' && window.confirm('Are you sure you want to delete this user? Their activities will be reassigned to the default admin.')) {
          deleteUser(userId)
            .then(() => isClient && addToast('Success', 'User has been deleted.', 'success'))
            .catch((error: Error) => isClient && addToast('Action Prohibited', error.message, 'error'));
      }
  }

  const closeUserModal = () => {
    setIsUserModalOpen(false);
    setUserToEdit(null);
    userModalTriggerRef.current?.focus();
  }

  const handleSaveUser = (data: NewUserData) => {
    const isEditing = !!userToEdit;
    const promise = isEditing
      ? updateUser(userToEdit.id, data)
      : addUser(data);

    promise
        .then(() => {
            isClient && addToast('Success', `User successfully ${isEditing ? 'updated' : 'added'}.`, 'success');
            closeUserModal();
        })
        .catch((error) => {
            isClient && addToast('Error', 'There was a problem saving the user.', 'error');
            console.error(error);
        });
  };
  
  // --- Category Management Handlers ---
  const handleAddCategory = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newCategoryName.trim()) return;
      addCategory(newCategoryName.trim())
        .then(() => {
            isClient && addToast('Success', `Category "${newCategoryName}" added.`, 'success');
            setNewCategoryName('');
        })
        .catch((error: Error) => isClient && addToast('Error', error.message, 'error'));
  };

  const handleDeleteCategory = (category: Category) => {
      if (!isClient) return;
      
      if (typeof window !== 'undefined' && window.confirm(`Are you sure you want to delete the "${category.name}" category? All activities under it will be moved to "Unplanned Incident".`)) {
          deleteCategory(category.id)
            .then(() => isClient && addToast('Success', `Category "${category.name}" deleted.`, 'success'))
            .catch((error: Error) => isClient && addToast('Action Prohibited', error.message, 'error'));
      }
  };

  // --- Geofence Management Handlers ---
  const handleShapeDrawn = (shapeData: NewGeofenceData) => {
      setPendingShape(shapeData);
      setGeofenceToEdit(null);
      setIsGeofenceModalOpen(true);
  };

  const handleEditGeofence = (geofence: Geofence) => {
      setGeofenceToEdit(geofence);
      setPendingShape(null);
      setIsGeofenceModalOpen(true);
  };

  const handleDeleteGeofence = (geofenceId: string) => {
      if (!isClient) return;
      
      if (typeof window !== 'undefined' && window.confirm('Are you sure you want to delete this geofence zone?')) {
          deleteGeofence(geofenceId)
            .then(() => isClient && addToast('Success', 'Geofence zone deleted.', 'success'))
            .catch((err) => isClient && addToast('Error', 'Could not delete geofence.', 'error'));
      }
  };

  const closeGeofenceModal = () => {
      setIsGeofenceModalOpen(false);
      setGeofenceToEdit(null);
      setPendingShape(null);
  };

  const handleSaveGeofence = (name: string) => {
    if (geofenceToEdit) {
        // Editing an existing geofence's name
        updateGeofence(geofenceToEdit.id, { name })
            .then(() => isClient && addToast('Success', 'Geofence updated.', 'success'))
            .catch((err) => isClient && addToast('Error', 'Failed to update geofence.', 'error'));
    } else if (pendingShape) {
        // Creating a new geofence from a drawn shape
        addGeofence({ ...pendingShape, name })
            .then(() => isClient && addToast('Success', 'Geofence created.', 'success'))
            .catch((err) => isClient && addToast('Error', 'Failed to create geofence.', 'error'));
    }
  };

  // --- WhatsApp Simulator Handler ---
  const handleSimulateMessage = async (data: { userId: string; message: string; photo?: string; audioBlob?: Blob | null; }) => {
    const toastMessage = data.audioBlob ? 'Transcribing and parsing voice note...' : 'Parsing message with AI...';
    isClient && addToast('Info', toastMessage, 'info');
    
    try {
        const parsedData = await parseWhatsAppMessage({
            message: data.message,
            photo: data.photo,
            audioBlob: data.audioBlob,
            categories,
        });

        // If a voice note was transcribed, the original message field is empty.
        // We use the AI's transcription as the notes for the activity.
        const notes = data.audioBlob ? parsedData.notes : data.message;
        
        const maintenanceUser = users.find(u => u.role === 'Maintenance');
        const adminUser = users.find(u => u.role === 'Admin');

        let assigned_to_user_id: string | undefined;
        let status: ActivityStatus = 'Open';

        if (parsedData.category_id === 'maintenance' && maintenanceUser) {
            assigned_to_user_id = maintenanceUser.id;
        } else if (adminUser) {
            assigned_to_user_id = adminUser.id; // Default assignment to Admin
        } else {
            status = 'Unassigned'; // Fallback if no admin found
        }
        
        const newActivityData: NewActivityData = {
            user_id: data.userId,
            category_id: parsedData.category_id,
            subcategory: parsedData.subcategory,
            location: parsedData.location,
            notes: notes,
            photo_url: data.photo,
            status,
            assigned_to_user_id,
        };
        
        await addActivity(newActivityData);
        isClient && addToast('Success', `Simulation successful! New "${parsedData.subcategory}" activity created.`, 'success');

    } catch (error) {
        console.error("AI Parsing Error:", error);
        isClient && addToast('Error', 'AI failed to parse the message. Please check the console.', 'error');
    }
  };

  // Show loading until client-side hydration
  if (!isClient || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* --- User Management Section --- */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
                <p className="text-muted-foreground">Add, edit, or remove staff members from the system.</p>
            </div>
            <button
            onClick={handleAddUser}
            className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
            >
            <PlusCircle className="h-4 w-4" />
            Add User
            </button>
        </div>
        
        <div className="bg-secondary/30 border border-border rounded-lg">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                <thead className="bg-secondary/50">
                    <tr>
                    <th className="p-4 font-medium">Name</th>
                    <th className="p-4 font-medium hidden sm:table-cell">Role</th>
                    <th className="p-4 font-medium hidden md:table-cell">Phone Number</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(user => (
                    <tr key={user.id} className="border-t border-border">
                        <td className="p-4 flex items-center gap-3 font-medium">
                            <div className="h-9 w-9 rounded-full bg-secondary flex-shrink-0 items-center justify-center flex">
                                <UserIcon size={18} className="text-muted-foreground"/>
                            </div>
                            <div className="flex flex-col sm:hidden">
                                <span>{user.name}</span>
                                <span className="text-xs text-muted-foreground">{user.role}</span>
                            </div>
                            <span className="hidden sm:inline">{user.name}</span>
                        </td>
                        <td className="p-4 text-muted-foreground hidden sm:table-cell">{user.role}</td>
                        <td className="p-4 text-muted-foreground hidden md:table-cell">{user.phone_number}</td>
                        <td className="p-4 text-right">
                        <div className="flex justify-end gap-1 sm:gap-2">
                            <button onClick={() => handleEditUser(user)} aria-label={`Edit ${user.name}`} className="p-2 text-muted-foreground hover:text-primary rounded-md hover:bg-secondary"><Edit size={16} /></button>
                            <button 
                                onClick={() => handleDeleteUser(user.id)} 
                                aria-label={`Delete ${user.name}`}
                                className="p-2 text-muted-foreground hover:text-destructive rounded-md hover:bg-secondary disabled:text-muted/50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                disabled={user.id === '1'}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
        </div>
      </div>

      <hr className="border-border" />
      
      {/* --- Category Management Section --- */}
      <div className="space-y-6">
        <div>
            <h2 className="text-2xl font-bold tracking-tight">Category Management</h2>
            <p className="text-muted-foreground">Define custom incident categories for reporting.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-secondary/30 border border-border rounded-lg p-4 space-y-3 h-fit">
                <h3 className="text-lg font-semibold">Current Categories</h3>
                <ul className="space-y-2">
                    {categories.map(cat => (
                        <li key={cat.id} className="flex items-center justify-between bg-secondary p-2 rounded-md">
                            <div className="flex items-center gap-3">
                                <Tag className="h-5 w-5 text-primary" />
                                <span className="font-medium">{cat.name}</span>
                                {cat.isSystem && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">System</span>}
                            </div>
                            {!cat.isSystem && (
                                <button onClick={() => handleDeleteCategory(cat)} aria-label={`Delete ${cat.name}`} className="p-2 text-muted-foreground hover:text-destructive rounded-md hover:bg-background/50"><Trash2 size={16} /></button>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
             <div className="bg-secondary/30 border border-border rounded-lg p-4 space-y-3 h-fit">
                <h3 className="text-lg font-semibold">Add New Category</h3>
                <form onSubmit={handleAddCategory} className="flex items-center gap-2">
                    <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="e.g., Sports Events"
                        className="flex-grow bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button type="submit" className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors">
                        <PlusCircle className="h-4 w-4" /> Add
                    </button>
                </form>
            </div>
        </div>
      </div>

      <hr className="border-border" />

      {/* --- Geofence Management Section --- */}
      <div className="space-y-6">
        <div>
            <h2 className="text-2xl font-bold tracking-tight">Geofence Management</h2>
            <p className="text-muted-foreground">Draw and manage geographic zones on the campus map.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <DynamicGeofenceMap geofences={geofences} onGeofenceCreate={handleShapeDrawn} />
            </div>
            <div className="lg:col-span-1 bg-secondary/30 border border-border rounded-lg p-4 space-y-3 h-fit">
                <h3 className="text-lg font-semibold">Defined Zones</h3>
                {geofences.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No zones created. Use the map tools to draw a new zone.</p>
                ) : (
                    <ul className="space-y-2">
                        {geofences.map(fence => (
                            <li key={fence.id} className="flex items-center justify-between bg-secondary p-2 rounded-md">
                                <div className="flex items-center gap-3">
                                    <MapPin className="h-5 w-5 text-primary" />
                                    <span className="font-medium">{fence.name}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => handleEditGeofence(fence)} aria-label={`Edit ${fence.name}`} className="p-2 text-muted-foreground hover:text-primary rounded-md hover:bg-background/50"><Edit size={16} /></button>
                                    <button onClick={() => handleDeleteGeofence(fence.id)} aria-label={`Delete ${fence.name}`} className="p-2 text-muted-foreground hover:text-destructive rounded-md hover:bg-background/50"><Trash2 size={16} /></button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
      </div>
      
      <hr className="border-border" />

      {/* --- Developer Tools Section --- */}
      <div className="space-y-6">
        <div>
            <h2 className="text-2xl font-bold tracking-tight">Developer Tools</h2>
            <p className="text-muted-foreground">Simulate events for testing and development.</p>
        </div>
        <WhatsAppSimulator users={users} onSimulate={handleSimulateMessage} />
      </div>

      {/* --- Modals --- */}
      <UserFormModal
        isOpen={isUserModalOpen}
        onClose={closeUserModal}
        onSave={handleSaveUser}
        userToEdit={userToEdit}
      />
      <GeofenceFormModal
        isOpen={isGeofenceModalOpen}
        onClose={closeGeofenceModal}
        onSave={handleSaveGeofence}
        geofenceToEdit={geofenceToEdit}
      />
    </div>
  );
};

export default AdminPage;
