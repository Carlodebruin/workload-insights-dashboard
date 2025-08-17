import React, { useState, useEffect, useRef } from 'react';
import { Activity, User, Category, ActivityStatus, ActivityUpdate } from '../types';
import { HeartPulse, Users as UsersIcon, Building, Banknote, Wrench, Mic, CalendarClock, MapPin, ImageOff, MessageSquare, MoreVertical, Edit, Trash2, CheckCircle, Clock, GitPullRequest, UserCheck, MessageSquarePlus, Info, Paperclip } from 'lucide-react';
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
  onAddUpdate: (activity: Activity) => void;
  onQuickStatusChange: (activityId: string, newStatus: ActivityStatus) => void;
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
                    onClick={() => onImageClick(update.photo_url!)}
                    className="flex items-center gap-1.5 mt-1.5 text-primary hover:underline"
                >
                    <Paperclip size={12} /> View attached photo
                </button>
            )}
        </div>
    );
}

const ActivityCard: React.FC<ActivityCardProps> = ({ activity, user, assignedUser, category, users, isHighlighted = false, onEdit, onDelete, onTaskAction, onAddUpdate, onQuickStatusChange }) => {
  const { subcategory, location, timestamp, notes, photo_url, updates } = activity;
  
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
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
  
  const cardClasses = `bg-secondary/30 border rounded-lg p-4 flex flex-col justify-between transition-all duration-500 hover:border-primary/50 relative ${isHighlighted ? "border-primary shadow-lg shadow-primary/20" : "border-border"}`;
  const actionButtonStyles = "px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors flex-1 text-center";


  return (
    <>
      <div className={cardClasses} style={{ height: 'calc(100% - 1rem)'}}>
        <div className="flex-grow flex flex-col min-h-0">
          <div className="absolute top-2 right-2 z-20">
              <button
                  ref={menuButtonRef}
                  onClick={() => setIsMenuOpen(prev => !prev)}
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
                      <button onClick={() => { onAddUpdate(activity); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-secondary">
                          <MessageSquarePlus size={14} /> Add Update
                      </button>
                      <button onClick={() => { onTaskAction(activity); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-secondary">
                          <GitPullRequest size={14} /> Task Actions
                      </button>
                      <div className="my-1 h-px bg-border" />
                      <button onClick={() => { onEdit(activity); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-secondary">
                          <Edit size={14} /> Edit Incident
                      </button>
                      <button onClick={() => { onDelete(activity.id); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-secondary text-destructive">
                          <Trash2 size={14} /> Delete Incident
                      </button>
                  </div>
              )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            {photo_url && (
                <div className="flex-shrink-0 w-full sm:w-24 h-24">
                    <button
                      onClick={() => openImageModal(photo_url)}
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
                <div className="pr-8">
                    <div className="flex items-center gap-3">
                        <CategoryIcon categoryName={categoryName} />
                        <h4 className="text-base font-semibold">{categoryName} - <span className="font-normal">{subcategory}</span></h4>
                    </div>
                    {user && <p className="text-xs text-muted-foreground mt-1">Logged by: {user.name} ({user.role})</p>}
                </div>
                <div className="text-xs text-muted-foreground mt-2 flex items-start gap-x-4">
                  <div className="flex items-center gap-1.5"><CalendarClock className="h-3 w-3" /> {formattedTimestamp}</div>
                  <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {location}</div>
                </div>
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
            <div className="flex items-center gap-2 pt-1">
                {activity.status === 'Unassigned' && (
                    <>
                        <button onClick={() => onTaskAction(activity)} className={`${actionButtonStyles} bg-primary text-primary-foreground hover:bg-primary/90`}>
                            Assign Task
                        </button>
                        <button onClick={() => onQuickStatusChange(activity.id, 'Open')} className={`${actionButtonStyles} bg-secondary text-secondary-foreground hover:bg-secondary/80`}>
                            Mark as Open
                        </button>
                    </>
                )}
                {(activity.status === 'Open' || activity.status === 'In Progress') && (
                    <>
                         <button onClick={() => onTaskAction(activity)} className={`${actionButtonStyles} bg-secondary text-secondary-foreground hover:bg-secondary/80`}>
                            Update / Reassign
                        </button>
                        <button onClick={() => onQuickStatusChange(activity.id, 'Resolved')} className={`${actionButtonStyles} bg-green-600 text-white hover:bg-green-700`}>
                            Close Task
                        </button>
                    </>
                )}
                {activity.status === 'Resolved' && (
                    <button onClick={() => onQuickStatusChange(activity.id, 'Open')} className={`${actionButtonStyles} bg-yellow-500 text-white hover:bg-yellow-600 w-full`}>
                        Reopen Task
                    </button>
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
