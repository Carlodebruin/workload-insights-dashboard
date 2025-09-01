import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Calendar, MapPin, User, Users, Clock, GitPullRequest, CheckCircle, MessageSquare, Edit, Trash2, UserCheck, AlertCircle, FileText, History, Settings, Plus } from 'lucide-react';
import { Activity, User as UserType, Category, ActivityStatus, ActivityUpdate } from '../types';
import Spinner from './Spinner';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface TaskDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: Activity;
  users: UserType[];
  categories: Category[];
  // All task management functions consolidated
  onEdit: (activity: Activity) => void;
  onDelete: (activityId: string) => void;
  onStatusChange: (activityId: string, newStatus: ActivityStatus) => Promise<void>;
  onAssign: (activityId: string, userId: string, instructions?: string) => Promise<void>;
  onAddUpdate: (activityId: string, notes: string, updateType?: 'progress' | 'status_change' | 'assignment' | 'completion') => Promise<void>;
}

const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  isOpen,
  onClose,
  activity,
  users,
  categories,
  onEdit,
  onDelete,
  onStatusChange,
  onAssign,
  onAddUpdate
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'updates' | 'actions'>('overview');
  const [newNote, setNewNote] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(activity.assigned_to_user_id || '');
  const [instructions, setInstructions] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(modalRef, isOpen);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview');
      setNewNote('');
      setSelectedUserId(activity.assigned_to_user_id || '');
      setInstructions('');
    }
  }, [isOpen, activity]);

  const handleEscKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, handleEscKey]);

  const handleStatusChange = async (newStatus: ActivityStatus) => {
    setIsLoading(true);
    try {
      await onStatusChange(activity.id, newStatus);
      if (newStatus === 'Resolved') {
        onClose();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedUserId) return;
    setIsLoading(true);
    try {
      await onAssign(activity.id, selectedUserId, instructions.trim() || undefined);
      setInstructions('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUpdate = async () => {
    if (!newNote.trim()) return;
    setIsLoading(true);
    try {
      await onAddUpdate(activity.id, newNote.trim(), 'progress');
      setNewNote('');
      setActiveTab('updates'); // Switch to updates tab to see the new note
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    if (typeof window !== 'undefined' && window.confirm("Are you sure you want to delete this task?")) {
      onDelete(activity.id);
      onClose();
    }
  };

  if (!isOpen) return null;

  const user = users.find(u => u.id === activity.user_id);
  const assignedUser = users.find(u => u.id === activity.assigned_to_user_id);
  const category = categories.find(c => c.id === activity.category_id);

  const statusConfig = {
    'Unassigned': { icon: <MessageSquare size={16} />, color: "bg-gray-500", label: "Unassigned" },
    'Open': { icon: <GitPullRequest size={16} />, color: "bg-red-500", label: "Open" },
    'In Progress': { icon: <Clock size={16} />, color: "bg-yellow-500", label: "In Progress" },
    'Resolved': { icon: <CheckCircle size={16} />, color: "bg-green-500", label: "Resolved" }
  };

  const { icon, color, label } = statusConfig[activity.status as ActivityStatus] || statusConfig.Unassigned;

  const tabClasses = "px-4 py-2 text-sm font-medium rounded-t-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2";
  const activeTabClasses = "bg-primary text-primary-foreground";
  const inactiveTabClasses = "bg-secondary text-secondary-foreground hover:bg-secondary/80";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-details-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="relative bg-card p-0 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] border border-border overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-border">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className={`flex items-center gap-1.5 text-xs font-semibold text-white ${color} px-2 py-1 rounded-full`}>
                {icon}
                {label}
              </div>
              <span className="text-sm text-muted-foreground">
                #{activity.id.slice(-6).toUpperCase()}
              </span>
            </div>
            <h2 id="task-details-title" className="text-xl font-semibold mb-1 truncate">
              {activity.subcategory}
            </h2>
            <p className="text-sm text-muted-foreground flex items-center gap-4">
              <span className="flex items-center gap-1">
                <MapPin size={14} />
                {activity.location}
              </span>
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                {new Date(activity.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full text-muted-foreground hover:bg-secondary transition-colors" 
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-secondary/30">
          <button
            onClick={() => setActiveTab('overview')}
            className={`${tabClasses} ${activeTab === 'overview' ? activeTabClasses : inactiveTabClasses}`}
          >
            <FileText size={16} className="inline mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('updates')}
            className={`${tabClasses} ${activeTab === 'updates' ? activeTabClasses : inactiveTabClasses}`}
          >
            <History size={16} className="inline mr-2" />
            Updates ({activity.updates?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={`${tabClasses} ${activeTab === 'actions' ? activeTabClasses : inactiveTabClasses}`}
          >
            <Settings size={16} className="inline mr-2" />
            Actions
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Task Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <User size={16} />
                    Task Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-muted-foreground">Category:</span>
                      <span className="ml-2">{category?.name || 'Uncategorized'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">Type:</span>
                      <span className="ml-2">{activity.subcategory}</span>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">Reporter:</span>
                      <span className="ml-2">{user?.name || 'Unknown'}</span>
                    </div>
                    {assignedUser && (
                      <div>
                        <span className="font-medium text-muted-foreground">Assigned to:</span>
                        <span className="ml-2">{assignedUser.name} ({assignedUser.role})</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <MessageSquare size={16} />
                    Description
                  </h3>
                  <div className="bg-secondary/50 p-3 rounded-md text-sm">
                    {activity.notes && activity.notes !== 'No additional details provided' && activity.notes.trim() 
                      ? activity.notes 
                      : 'No description provided'}
                  </div>
                </div>
              </div>

              {/* Assignment Instructions */}
              {activity.assignment_instructions && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <AlertCircle size={16} />
                    Current Instructions
                  </h3>
                  <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-md text-sm border-l-4 border-blue-500">
                    {activity.assignment_instructions}
                  </div>
                </div>
              )}

              {/* Resolution Notes */}
              {activity.resolution_notes && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle size={16} />
                    Resolution
                  </h3>
                  <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-md text-sm border-l-4 border-green-500">
                    {activity.resolution_notes}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'updates' && (
            <div className="space-y-4">
              {/* Add Update Form */}
              <div className="bg-secondary/30 p-4 rounded-md">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Plus size={16} />
                  Add Progress Note
                </h3>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a progress update, observation, or note..."
                  rows={3}
                  className="bg-input border border-border rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleAddUpdate}
                    disabled={!newNote.trim() || isLoading}
                    className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:bg-muted disabled:cursor-wait flex items-center gap-2"
                  >
                    {isLoading && <Spinner size="sm" />}
                    Add Update
                  </button>
                </div>
              </div>

              {/* Updates List */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <History size={16} />
                  Update History
                </h3>
                {activity.updates && activity.updates.length > 0 ? (
                  <div className="space-y-3">
                    {activity.updates
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .map((update) => {
                        const author = users.find(u => u.id === update.author_id);
                        return (
                          <div key={update.id} className="bg-secondary/20 p-3 rounded-md border-l-4 border-primary">
                            <div className="flex items-start justify-between mb-2">
                              <div className="text-sm font-medium">{author?.name || 'Unknown User'}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(update.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground mb-1">
                              {update.status_context && (
                                <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-medium mr-2">
                                  <GitPullRequest size={10} />
                                  {update.status_context}
                                </span>
                              )}
                              <span className="capitalize">{update.update_type || 'progress'}</span>
                            </div>
                            <div className="text-sm">{update.notes}</div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History size={24} className="mx-auto mb-2 opacity-50" />
                    <p>No updates yet</p>
                    <p className="text-xs">Add the first progress note above</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'actions' && (
            <div className="space-y-6">
              {/* Status Management */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <GitPullRequest size={16} />
                  Status Management
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(['Open', 'In Progress', 'Resolved', 'Unassigned'] as ActivityStatus[]).map((status) => {
                    const isCurrentStatus = activity.status === status;
                    const statusInfo = statusConfig[status];
                    return (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        disabled={isCurrentStatus || isLoading}
                        className={`px-3 py-2 text-xs rounded-md flex items-center gap-2 transition-colors
                          ${isCurrentStatus 
                            ? 'bg-secondary text-secondary-foreground cursor-default' 
                            : 'bg-primary text-primary-foreground hover:bg-primary/90'
                          }
                          disabled:opacity-50`}
                      >
                        {isLoading && <Spinner size="sm" />}
                        {statusInfo.icon}
                        {status}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Assignment */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <UserCheck size={16} />
                  Task Assignment
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Assign To</label>
                    <select 
                      value={selectedUserId} 
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="bg-input border border-border rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Select a staff member...</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.role})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Instructions (Optional)</label>
                    <textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="Provide specific instructions for this assignment..."
                      rows={2}
                      className="bg-input border border-border rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <button
                    onClick={handleAssign}
                    disabled={!selectedUserId || isLoading}
                    className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:bg-muted disabled:cursor-wait flex items-center gap-2"
                  >
                    {isLoading && <Spinner size="sm" />}
                    {activity.assigned_to_user_id ? 'Reassign Task' : 'Assign Task'}
                  </button>
                </div>
              </div>

              {/* Advanced Actions */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Settings size={16} />
                  Advanced Actions
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onEdit(activity)}
                    className="px-3 py-2 text-xs rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors flex items-center gap-2"
                  >
                    <Edit size={14} />
                    Edit Task Details
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-3 py-2 text-xs rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors flex items-center gap-2"
                  >
                    <Trash2 size={14} />
                    Delete Task
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskDetailsModal;