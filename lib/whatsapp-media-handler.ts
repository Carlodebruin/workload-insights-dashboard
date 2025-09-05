import { logSecureInfo, logSecureError } from './secure-logger';
import { withDb } from './db-wrapper';

/**
 * WhatsApp Media Handler
 * Handles images, documents, and other media attachments in task updates
 */

export interface MediaAttachment {
  id: string;
  mimeType: string;
  sha256: string;
  url?: string;
  caption?: string;
  size?: number;
}

export interface MediaProcessingResult {
  success: boolean;
  mediaUrl?: string;
  error?: string;
  mediaId?: string;
}

export class WhatsAppMediaHandler {
  /**
   * Process incoming media from WhatsApp Business API
   */
  static async processIncomingMedia(
    messageData: any,
    taskId?: string,
    userId?: string
  ): Promise<MediaProcessingResult> {
    try {
      const mediaData = this.extractMediaFromMessage(messageData);
      if (!mediaData) {
        return {
          success: false,
          error: 'No media found in message'
        };
      }

      // Download and process the media
      const processResult = await this.downloadAndStoreMedia(mediaData, taskId, userId);
      
      logSecureInfo('WhatsApp media processed', {
        operation: 'process_media',
        timestamp: new Date().toISOString()
      }, {
        mediaType: mediaData.mimeType,
        hasTask: !!taskId,
        success: processResult.success
      });

      return processResult;
    } catch (error) {
      logSecureError('Failed to process WhatsApp media', {
        operation: 'process_media',
        timestamp: new Date().toISOString()
      }, error instanceof Error ? error : undefined);

      return {
        success: false,
        error: 'Failed to process media attachment'
      };
    }
  }

  /**
   * Extract media data from WhatsApp message
   */
  private static extractMediaFromMessage(messageData: any): MediaAttachment | null {
    const { type } = messageData;
    
    // Handle different media types
    const mediaTypes = ['image', 'document', 'video', 'audio', 'voice'];
    
    for (const mediaType of mediaTypes) {
      if (type === mediaType && messageData[mediaType]) {
        const media = messageData[mediaType];
        return {
          id: media.id,
          mimeType: media.mime_type || `${mediaType}/unknown`,
          sha256: media.sha256,
          caption: media.caption || ''
        };
      }
    }

    return null;
  }

  /**
   * Download media from Meta's servers and store locally
   */
  private static async downloadAndStoreMedia(
    mediaData: MediaAttachment,
    taskId?: string,
    userId?: string
  ): Promise<MediaProcessingResult> {
    try {
      // For now, we'll store basic media info and generate placeholder URLs
      // In a full implementation, this would download from Meta's CDN
      
      const mediaUrl = await this.generateMediaUrl(mediaData);
      
      // Store media reference in database
      if (taskId && userId) {
        await withDb(async (prisma) => {
          await prisma.activityUpdate.create({
            data: {
              activity_id: taskId,
              author_id: userId,
              notes: `Media attachment: ${mediaData.caption || 'No caption'}`,
              photo_url: mediaUrl,
              update_type: 'progress'
            }
          });
        });
      }

      return {
        success: true,
        mediaUrl,
        mediaId: mediaData.id
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to download and store media'
      };
    }
  }

  /**
   * Generate a media URL (placeholder for now)
   */
  private static async generateMediaUrl(mediaData: MediaAttachment): Promise<string> {
    // This is a placeholder - in production, you would:
    // 1. Download the media from Meta's CDN using their API
    // 2. Upload to your own CDN/storage (AWS S3, Cloudinary, etc.)
    // 3. Return the permanent URL
    
    return `https://placeholder-media.example.com/${mediaData.id}.${this.getFileExtension(mediaData.mimeType)}`;
  }

  /**
   * Get file extension from MIME type
   */
  private static getFileExtension(mimeType: string): string {
    const extensions: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
      'text/plain': 'txt',
      'video/mp4': 'mp4',
      'audio/mpeg': 'mp3',
      'audio/ogg': 'ogg'
    };

    return extensions[mimeType] || 'bin';
  }

  /**
   * Check if media type is supported
   */
  static isSupportedMediaType(mimeType: string): boolean {
    const supportedTypes = [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain'
    ];

    return supportedTypes.includes(mimeType);
  }

  /**
   * Get user-friendly media type description
   */
  static getMediaTypeDescription(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'Photo';
    if (mimeType.startsWith('video/')) return 'Video';
    if (mimeType.startsWith('audio/')) return 'Audio';
    if (mimeType === 'application/pdf') return 'Document';
    return 'File';
  }
}

/**
 * Enhanced command system integration for media support
 */
export function enhanceCommandContextWithMedia(messageData: any) {
  const mediaData = messageData.image || messageData.document || messageData.video || messageData.audio;
  
  return {
    hasMedia: !!mediaData,
    mediaType: mediaData ? WhatsAppMediaHandler.getMediaTypeDescription(mediaData.mime_type) : null,
    mediaId: mediaData?.id,
    caption: mediaData?.caption || ''
  };
}