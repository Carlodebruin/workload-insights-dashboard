import React, { useState, useEffect, useRef } from 'react';
import { Activity, User, Category, ActivityStatus, ActivityUpdate } from '../types';
import { HeartPulse, Users as UsersIcon, Building, Banknote, Wrench, Mic, CalendarClock, MapPin, ImageOff, MessageSquare, MoreVertical, Edit, Trash2, CheckCircle, Clock, GitPullRequest, UserCheck, MessageSquarePlus, Info, Paperclip, Play, AlertCircle } from 'lucide-react';
import ImageModal from './ImageModal';

interface ActivityCardProps {
  activity: Activity;
  user?: User; // The user who logged the activity
  assignedUser?: User;
  category?: Category;
  users: User[]; // All users for looking up update authors
  isHighlighted?: boolean;
  onEdit: (activity: Activity) => void;
  onDelete: (activityId: string) => void;
  onTaskAction: (activity: Activity) => void;
  onQuickStatusChange: (activityId: string, newStatus: ActivityStatus) => void;
  onQuickStatusNote?: (activity: Activity, status: ActivityStatus, notePrompt: string) => void; // New: Quick status with note
  onViewDetails: (activity: Activity) => void; // New: View task details modal
}

const CategoryIcon: React.FC<{ categoryName: string }> = ({ categoryName }) => {
    const iconProps = { className: "h-5 w-5 text-primary" };
    const lowerCaseName = categoryName.toLowerCase();

    if (lowerCaseName.includes('wellness')) return <HeartPulse {...iconProps} />;
    if (lowerCaseName.includes('parent')) return <UsersIcon {...iconProps} />;
    if (lowerCaseName.includes('department')) return <Building {...iconProps} />;
    if (lowerCaseName.includes('fees')) return <Banknote {...iconProps} />;
    if (lowerCaseName.includes('maintenance')) return <Wrench {...iconProps} />;
    if (lowerCaseName.includes('meeting')) return <Mic {...iconProps} />;
    
    return <MessageSquare {...iconProps} />;
};

const StatusBadge: React.FC<{ activity: Activity, assignedUser?: User }> = ({ activity, assignedUser }) => {
    const { status, assignment_instructions } = activity;
    const statusConfig = {
        'Unassigned': { icon: <MessageSquare size={14} />, color: "bg-gray-500", text: "Unassigned" },
        'Open': { icon: <GitPullRequest size={14} />, color: "bg-red-500", text: "Open" },
        'In Progress': { icon: <Clock size={14} />, color: "bg-yellow-500", text: "In Progress" },
        'Resolved': { icon: <CheckCircle size={14} />, color: "bg-green-500", text: "Resolved" }
    };

    const { icon, color, text } = statusConfig[status as ActivityStatus] || statusConfig.Unassigned;

    return (
        <div>
            <div className="flex items-center gap-4">
                <div className={`flex items-center gap-1.5 text-xs font-semibold text-white ${color} px-2 py-1 rounded-full`}>
                    {icon}
                    <span>{text}</span>
                </div>
                {assignedUser && (
                     <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <UserCheck size={14} className="text-primary" />
                        <span>Assigned to: <span className="font-semibold text-foreground">{assignedUser.name}</span></span>
                    </div>
                )}
            </div>
            {assignment_instructions && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground pl-1 mt-2">
                    <Info size={14} className="text-primary flex-shrink-0 mt-0.5" />
                    <p>Instructions: <span className="text-foreground">{assignment_instructions}</span></p>
                </div>
            )}
        </div>
    );
};


const ActivityUpdateLog: React.FC<{ update: ActivityUpdate, author?: User, onImageClick: (url: string) => void }> = ({ update, author, onImageClick }) => {
    const formattedTimestamp = new Date(update.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
    return (
        <div className="text-xs pl-5 py-2 border-l-2 border-border/50 relative">
            <div className="absolute left-[-7px] top-4 h-3 w-3 bg-secondary border-2 border-primary rounded-full" />
            <p className="font-semibold text-muted-foreground">
                Update by {author?.name || 'Unknown'} on {formattedTimestamp}
            </p>
            <p className="text-foreground/90 mt-1">{update.notes}</p>
            {update.photo_url && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onImageClick(update.photo_url!); }}
                    className="flex items-center gap-1.5 mt-1.5 text-primary hover:underline"
                >
                    <Paperclip size={12} /> View attached photo
                </button>
            )}
        </div>
    );
}

const ActivityCard: React.FC<ActivityCardProps> = ({ activity, user, assignedUser, category, users, isHighlighted = false, onEdit, onDelete, onTaskAction, onQuickStatusChange, onQuickStatusNote, onViewDetails }) => {
  const { subcategory, location, timestamp, notes, photo_url, updates } = activity;
  
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) && !menuButtonRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openImageModal = (url: string) => {
    setModalImageUrl(url);
    setIsImageModalOpen(true);
  };

  const formattedTimestamp = new Date(timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const categoryName = category?.name || 'Uncategorized';
  
  const cardClasses = `bg-secondary/30 border rounded-lg p-4 flex flex-col justify-between transition-all duration-500 hover:border-primary/50 relative cursor-pointer ${isHighlighted ? "border-primary shadow-lg shadow-primary/20" : "border-border"}`;
  const actionButtonStyles = "px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors flex-1 text-center";


  return (
    <>
      <div 
        className={cardClasses} 
        style={{ height: 'calc(100% - 1rem)'}}
        onClick={() => onViewDetails(activity)}
      >
        <div className="flex-grow flex flex-col min-h-0">
          <div className="absolute top-2 right-2 z-20">
              <button
                  ref={menuButtonRef}
                  onClick={(e) => { e.stopPropagation(); setIsMenuOpen(prev => !prev); }}
                  className="p-1 rounded-full text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                  aria-label="Activity options"
              >
                  <MoreVertical size={18} />
              </button>
              {isMenuOpen && (
                  <div
                      ref={menuRef}
                      className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-md shadow-lg z-30 py-1"
                  >
                      <button onClick={(e) => { e.stopPropagation(); onTaskAction(activity); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-secondary">
                          <MessageSquarePlus size={14} /> Add Progress Note
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onTaskAction(activity); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-secondary">
                          <GitPullRequest size={14} /> Task Actions
                      </button>
                      <div className="my-1 h-px bg-border" />
                      <button onClick={(e) => { e.stopPropagation(); onEdit(activity); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-secondary">
                          <Edit size={14} /> Edit Incident
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onDelete(activity.id); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-secondary text-destructive">
                          <Trash2 size={14} /> Delete Incident
                      </button>
                  </div>
              )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            {photo_url && (
                <div className="flex-shrink-0 w-full sm:w-24 h-24">
                    <button
                      onClick={(e) => { e.stopPropagation(); openImageModal(photo_url); }}
                      className="w-full h-full block rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
                      aria-label={`View larger image for ${subcategory}`}
                    >
                      <img
                        src={photo_url}
                        alt={subcategory}
                        className="w-full h-full object-cover rounded-md border border-border cursor-pointer transition-transform hover:scale-105"
                      />
                    </button>
                </div>
            )}
            <div className="flex-grow">
                <div 
                    className="pr-8 cursor-pointer hover:bg-secondary/20 rounded-md p-2 -m-2 transition-colors"
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                    title="Click to expand task details"
                >
                    <div className="flex items-center gap-3">
                        <CategoryIcon categoryName={categoryName} />
                        <h4 className="text-base font-semibold">
                            {/* Prioritize actual problem description (notes) over generic subcategory */}
                            {notes && notes !== 'No additional details provided' && notes.trim() ? 
                                (notes.length > 50 ? `${notes.substring(0, 47)}...` : notes)
                                : subcategory === 'General Issue' ? 
                                    `${categoryName} Task`
                                    : subcategory
                            }
                        </h4>
                        <span className="text-xs text-muted-foreground px-2 py-1 bg-secondary/50 rounded-full">{categoryName}</span>
                    </div>
                    {user && <p className="text-xs text-muted-foreground mt-1">Logged by: {user.name} ({user.role})</p>}
                </div>
                <div className="text-xs text-muted-foreground mt-2 flex items-start gap-x-4">
                  <div className="flex items-center gap-1.5"><CalendarClock className="h-3 w-3" /> {formattedTimestamp}</div>
                  <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {location}</div>
                </div>
                
                {isExpanded && (
                    <div className="mt-3 p-3 bg-secondary/20 rounded-md border border-border/50">
                        <h5 className="text-sm font-semibold text-foreground mb-2">Task Details</h5>
                        <div className="space-y-2 text-xs">
                            <div><strong>Status:</strong> {activity.status}</div>
                            <div><strong>Location:</strong> {location}</div>
                            <div><strong>Category:</strong> {categoryName}</div>
                            <div><strong>Original Request:</strong> {subcategory}</div>
                            {assignedUser && <div><strong>Assigned to:</strong> {assignedUser.name} ({assignedUser.role})</div>}
                            {activity.assignment_instructions && <div><strong>Instructions:</strong> {activity.assignment_instructions}</div>}
                            {activity.resolution_notes && <div><strong>Resolution:</strong> {activity.resolution_notes}</div>}
                        </div>
                        <div className="flex gap-2 mt-3">
                            <button 
                                onClick={(e) => { e.stopPropagation(); onTaskAction(activity); }}
                                className="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-md hover:bg-primary/90 transition-colors"
                            >
                                Manage Task
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onTaskAction(activity); }}
                                className="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs rounded-md hover:bg-secondary/80 transition-colors"
                            >
                                Add Progress Note
                            </button>
                        </div>
                    </div>
                )}
            </div>
          </div>
          
           {/* Notes and Updates Section */}
           <div className="mt-2 space-y-2 flex-grow overflow-y-auto pr-2">
                {notes && (
                    <div className="flex items-start gap-3">
                        <MessageSquare className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                        <p className="text-sm text-foreground/80 bg-black/20 p-2 rounded-md whitespace-pre-wrap">{notes}</p>
                    </div>
                )}
                {updates && updates.length > 0 && (
                    <div className="space-y-1">
                        {updates.map(upd => (
                            <ActivityUpdateLog key={upd.id} update={upd} author={users.find(u => u.id === upd.author_id)} onImageClick={openImageModal} />
                        ))}
                    </div>
                )}
                {!notes && (!updates || updates.length === 0) && (
                     <div className="mt-2 flex items-center justify-center h-10 border-2 border-dashed border-border/50 rounded-md">
                        <p className="text-xs text-muted-foreground">No notes or updates for this incident.</p>
                    </div>
                )}
           </div>

        </div>
        <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
            <StatusBadge activity={activity} assignedUser={assignedUser} />
            <div className="space-y-2 pt-1">
                {/* Main Action Buttons */}
                <div className="flex items-center gap-2">
                    {activity.status === 'Unassigned' && (
                        <>
                            <button onClick={(e) => { e.stopPropagation(); onTaskAction(activity); }} className={`${actionButtonStyles} bg-primary text-primary-foreground hover:bg-primary/90`}>
                                Assign Task
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onQuickStatusChange(activity.id, 'Open'); }} className={`${actionButtonStyles} bg-secondary text-secondary-foreground hover:bg-secondary/80`}>
                                Mark as Open
                            </button>
                        </>
                    )}
                    {(activity.status === 'Open' || activity.status === 'In Progress') && (
                        <>
                             <button onClick={(e) => { e.stopPropagation(); onTaskAction(activity); }} className={`${actionButtonStyles} bg-secondary text-secondary-foreground hover:bg-secondary/80`}>
                                Update / Reassign
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onQuickStatusChange(activity.id, 'Resolved'); }} className={`${actionButtonStyles} bg-green-600 text-white hover:bg-green-700`}>
                                Close Task
                            </button>
                        </>
                    )}
                    {activity.status === 'Resolved' && (
                        <button onClick={(e) => { e.stopPropagation(); onQuickStatusChange(activity.id, 'Open'); }} className={`${actionButtonStyles} bg-yellow-500 text-white hover:bg-yellow-600 w-full`}>
                            Reopen Task
                        </button>
                    )}
                </div>
                
                {/* Quick Status Note Actions */}
                {onQuickStatusNote && (
                    <div className="flex items-center gap-1.5">
                        {activity.status === 'Open' && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onQuickStatusNote(activity, 'In Progress', 'What are you starting to work on?'); }}
                                className="px-2 py-1 text-xs bg-blue-500 text-white hover:bg-blue-600 rounded-md transition-colors flex items-center gap-1"
                                title="Start work with note"
                            >
                                <Play size={12} />
                                Start Work
                            </button>
                        )}
                        {(activity.status === 'Open' || activity.status === 'In Progress') && (
                            <>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onQuickStatusNote(activity, activity.status, 'What progress have you made?'); }}
                                    className="px-2 py-1 text-xs bg-orange-500 text-white hover:bg-orange-600 rounded-md transition-colors flex items-center gap-1"
                                    title="Add progress note"
                                >
                                    <MessageSquare size={12} />
                                    Progress Note
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onQuickStatusNote(activity, 'Resolved', 'How was this resolved?'); }}
                                    className="px-2 py-1 text-xs bg-green-500 text-white hover:bg-green-600 rounded-md transition-colors flex items-center gap-1"
                                    title="Complete with note"
                                >
                                    <CheckCircle size={12} />
                                    Complete
                                </button>
                            </>
                        )}
                        {activity.status === 'Resolved' && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onQuickStatusNote(activity, 'Open', 'Why is this being reopened?'); }}
                                className="px-2 py-1 text-xs bg-yellow-500 text-white hover:bg-yellow-600 rounded-md transition-colors flex items-center gap-1"
                                title="Reopen with note"
                            >
                                <AlertCircle size={12} />
                                Reopen
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
      </div>
      {isImageModalOpen && modalImageUrl && (
        <ImageModal
          imageUrl={modalImageUrl}
          altText={subcategory}
          onClose={() => setIsImageModalOpen(false)}
          triggerRef={menuButtonRef} // Just needs a valid ref to return focus
        />
      )}
    </>
  );
};

export default ActivityCard;
