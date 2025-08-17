import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { Bot, ImagePlus, Send, Mic, Square, Trash2, Play } from 'lucide-react';
import Spinner from './Spinner';

interface WhatsAppSimulatorProps {
    users: User[];
    onSimulate: (data: { userId: string; message: string; photo?: string; audioBlob?: Blob | null; }) => Promise<void>;
}

const WhatsAppSimulator: React.FC<WhatsAppSimulatorProps> = ({ users, onSimulate }) => {
    const [userId, setUserId] = useState<string>(users[0]?.id || '');
    const [message, setMessage] = useState('');
    const [photo, setPhoto] = useState<string | undefined>(undefined);
    const [photoPreview, setPhotoPreview] = useState<string | undefined>(undefined);
    
    // Voice note state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const timerIntervalRef = useRef<number | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    
    const [isSimulating, setIsSimulating] = useState(false);
    
    useEffect(() => {
        // Cleanup audio URL on unmount
        return () => {
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl]);


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                setPhotoPreview(result);
                setPhoto(result); 
            };
            reader.readAsDataURL(file);
        }
    };

    const handleStartRecording = async () => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                audioChunksRef.current = [];
                
                mediaRecorderRef.current.ondataavailable = (event) => {
                    audioChunksRef.current.push(event.data);
                };

                mediaRecorderRef.current.onstop = () => {
                    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    setAudioBlob(blob);
                    const url = URL.createObjectURL(blob);
                    setAudioUrl(url);
                    stream.getTracks().forEach(track => track.stop()); // Stop the mic access
                };
                
                mediaRecorderRef.current.start();
                setIsRecording(true);
                setRecordingTime(0);
                timerIntervalRef.current = window.setInterval(() => {
                    setRecordingTime(prev => prev + 1);
                }, 1000);

            } catch (err) {
                console.error("Error accessing microphone:", err);
                alert("Microphone access was denied. Please allow microphone access in your browser settings to use this feature.");
            }
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if(timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
    };

    const handleDeleteAudio = () => {
        setAudioBlob(null);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
        setRecordingTime(0);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId || (!message.trim() && !audioBlob)) {
            alert('Please select a user and enter a message or record a voice note.');
            return;
        }
        setIsSimulating(true);
        await onSimulate({
            userId: userId,
            message,
            photo,
            audioBlob,
        });
        setIsSimulating(false);
        // Reset form after simulation
        setMessage('');
        setPhoto(undefined);
        setPhotoPreview(undefined);
        handleDeleteAudio();
    };
    
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const inputStyles = "bg-input border border-border rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary";
    const labelStyles = "block text-sm font-medium text-muted-foreground mb-1";
    const actionButtonStyles = "cursor-pointer flex items-center gap-2 text-sm bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md px-3 py-2 transition-colors";

    return (
        <div className="bg-secondary/30 border border-border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
                <Bot className="h-6 w-6 text-primary" />
                <div>
                    <h3 className="text-lg font-semibold">WhatsApp Ingestion Simulator</h3>
                    <p className="text-xs text-muted-foreground">Test how the AI parses incoming messages to create activities.</p>
                </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-1">
                        <label htmlFor="sim-user-id" className={labelStyles}>Simulate as User</label>
                        <select
                            id="sim-user-id"
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            className={inputStyles}
                        >
                            {users.map(user => (
                                <option key={user.id} value={user.id}>{user.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="sm:col-span-2">
                        <label htmlFor="sim-message" className={labelStyles}>Message Content (Optional if voice note is used)</label>
                        <textarea
                            id="sim-message"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={3}
                            className={inputStyles}
                            placeholder="e.g., There's a water leak in the second floor bathroom."
                            disabled={!!audioBlob}
                        />
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <label htmlFor="sim-photo" className={actionButtonStyles}>
                            <ImagePlus className="h-4 w-4" />
                            <span>Attach Photo</span>
                        </label>
                        <input id="sim-photo" type="file" className="sr-only" accept="image/*" onChange={handleFileChange} />
                        
                         {!audioBlob && (
                            isRecording ? (
                                <button type="button" onClick={handleStopRecording} className={`${actionButtonStyles} bg-red-500 text-white hover:bg-red-600`}>
                                    <Square className="h-4 w-4" />
                                    <span>Stop ({formatTime(recordingTime)})</span>
                                </button>
                            ) : (
                                <button type="button" onClick={handleStartRecording} className={actionButtonStyles}>
                                    <Mic className="h-4 w-4" />
                                    <span>Record Voice</span>
                                </button>
                            )
                        )}
                    </div>

                    <div className="flex-1 w-full sm:w-auto flex items-center gap-2">
                        {photoPreview && <img src={photoPreview} alt="Preview" className="h-12 w-12 object-cover rounded-md border border-border" />}
                        {audioUrl && (
                            <div className="flex items-center gap-2 bg-secondary p-2 rounded-md">
                                <audio src={audioUrl} controls className="h-8" />
                                <button type="button" onClick={handleDeleteAudio} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={16} /></button>
                            </div>
                        )}
                    </div>
                    
                    <button
                        type="submit"
                        disabled={isSimulating || (!message.trim() && !audioBlob)}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:bg-muted disabled:cursor-wait"
                    >
                        {isSimulating ? <Spinner size="sm" /> : <Send className="h-4 w-4" />}
                        <span>{isSimulating ? 'Simulating...' : 'Simulate Incoming Message'}</span>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default WhatsAppSimulator;
