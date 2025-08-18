import { whatsappConfig } from './config';
import { WhatsAppMediaContent, WhatsAppLocationContent, WhatsAppInboundMessage } from './types';
import { prisma } from '../prisma';
import { logSecureInfo, logSecureError, logSecureWarning } from '../secure-logger';
import { createHash } from 'crypto';
import path from 'path';
import fs from 'fs/promises';

/**
 * WhatsApp Media Handler
 * Handles media downloads, processing, and incident report creation from WhatsApp messages
 */

export interface MediaDownloadResult {
  success: boolean;
  localPath?: string;
  mediaInfo?: {
    filename: string;
    mimeType: string;
    size: number;
    sha256: string;
  };
  error?: string;
}

export interface IncidentFromMediaResult {
  success: boolean;
  activityId?: string;
  activity?: any;
  error?: string;
}

export interface LocationAnalysis {
  isValidLocation: boolean;
  accuracy?: number;
  nearestKnownLocation?: string;
  suggestedCategory?: string;
}

export class WhatsAppMediaHandler {
  private static readonly MEDIA_STORAGE_PATH = '/tmp/whatsapp-media';
  private static readonly MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB
  private static readonly ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  private static readonly ALLOWED_AUDIO_TYPES = ['audio/ogg', 'audio/mpeg', 'audio/mp4'];
  private static readonly ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/3gpp'];
  private static readonly ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'text/plain'];

  /**
   * Process incoming media message and create incident report if applicable
   */
  public static async processMediaMessage(
    message: WhatsAppInboundMessage,
    whatsappUser: any
  ): Promise<IncidentFromMediaResult> {
    try {
      if (!whatsappUser.linkedUser) {
        return {
          success: false,
          error: 'User not linked to system account'
        };
      }

      switch (message.type) {
        case 'image':
          return await this.processImageMessage(message, whatsappUser);
        
        case 'voice':
        case 'audio':
          return await this.processAudioMessage(message, whatsappUser);
        
        case 'location':
          return await this.processLocationMessage(message, whatsappUser);
        
        case 'video':
          return await this.processVideoMessage(message, whatsappUser);
        
        case 'document':
          return await this.processDocumentMessage(message, whatsappUser);
        
        default:
          return {
            success: false,
            error: `Unsupported media type: ${message.type}`
          };
      }
    } catch (error) {
      logSecureError('Failed to process media message', {
        operation: 'process_media_message'
      }, error instanceof Error ? error : undefined);

      return {
        success: false,
        error: 'Failed to process media message'
      };
    }
  }

  /**
   * Process image message - create incident report with photo
   */
  private static async processImageMessage(
    message: WhatsAppInboundMessage,
    whatsappUser: any
  ): Promise<IncidentFromMediaResult> {
    try {
      const imageMedia = message.image;
      if (!imageMedia) {
        return { success: false, error: 'No image data found' };
      }

      // Download image
      const downloadResult = await this.downloadMedia(imageMedia.id, imageMedia.mime_type);
      if (!downloadResult.success) {
        return { success: false, error: downloadResult.error };
      }

      // Create incident report with image
      const activity = await prisma.activity.create({
        data: {
          user_id: whatsappUser.linkedUser.id,
          category_id: await this.getDefaultCategoryId(),
          subcategory: 'Photo Report',
          location: 'Location from WhatsApp',
          notes: imageMedia.caption || 'Incident reported via WhatsApp photo',
          photo_url: downloadResult.localPath,
          status: 'Open',
          timestamp: new Date(parseInt(message.timestamp) * 1000)
        }
      });

      // Link to WhatsApp message
      await prisma.whatsAppMessage.updateMany({
        where: { waId: message.id },
        data: { relatedActivityId: activity.id }
      });

      logSecureInfo('Incident created from WhatsApp image', {
        operation: 'create_incident_from_image'
      }, {
        activityId: activity.id,
        userId: whatsappUser.linkedUser.id,
        hasCaption: !!imageMedia.caption,
        fileSize: downloadResult.mediaInfo?.size
      });

      return {
        success: true,
        activityId: activity.id,
        activity
      };
    } catch (error) {
      logSecureError('Failed to process image message', {
        operation: 'process_image_message'
      }, error instanceof Error ? error : undefined);

      return {
        success: false,
        error: 'Failed to create incident from image'
      };
    }
  }

  /**
   * Process voice/audio message - create incident with voice note
   */
  private static async processAudioMessage(
    message: WhatsAppInboundMessage,
    whatsappUser: any
  ): Promise<IncidentFromMediaResult> {
    try {
      const audioMedia = message.voice || message.audio;
      if (!audioMedia) {
        return { success: false, error: 'No audio data found' };
      }

      // Download audio
      const downloadResult = await this.downloadMedia(audioMedia.id, audioMedia.mime_type);
      if (!downloadResult.success) {
        return { success: false, error: downloadResult.error };
      }

      // Create incident report with audio note
      const activity = await prisma.activity.create({
        data: {
          user_id: whatsappUser.linkedUser.id,
          category_id: await this.getDefaultCategoryId(),
          subcategory: 'Voice Report',
          location: 'Location from WhatsApp',
          notes: `Voice note incident report. Audio file: ${downloadResult.mediaInfo?.filename}`,
          photo_url: downloadResult.localPath, // Store audio path in photo_url for now
          status: 'Open',
          timestamp: new Date(parseInt(message.timestamp) * 1000)
        }
      });

      // Link to WhatsApp message
      await prisma.whatsAppMessage.updateMany({
        where: { waId: message.id },
        data: { relatedActivityId: activity.id }
      });

      logSecureInfo('Incident created from WhatsApp voice message', {
        operation: 'create_incident_from_voice'
      }, {
        activityId: activity.id,
        userId: whatsappUser.linkedUser.id,
        audioType: message.type,
        fileSize: downloadResult.mediaInfo?.size
      });

      return {
        success: true,
        activityId: activity.id,
        activity
      };
    } catch (error) {
      logSecureError('Failed to process audio message', {
        operation: 'process_audio_message'
      }, error instanceof Error ? error : undefined);

      return {
        success: false,
        error: 'Failed to create incident from audio'
      };
    }
  }

  /**
   * Process location message - create incident with GPS coordinates
   */
  private static async processLocationMessage(
    message: WhatsAppInboundMessage,
    whatsappUser: any
  ): Promise<IncidentFromMediaResult> {
    try {
      const location = message.location;
      if (!location) {
        return { success: false, error: 'No location data found' };
      }

      // Analyze location for validity and context
      const locationAnalysis = await this.analyzeLocation(location);

      // Create incident report with location
      const activity = await prisma.activity.create({
        data: {
          user_id: whatsappUser.linkedUser.id,
          category_id: await this.getLocationBasedCategoryId(locationAnalysis),
          subcategory: 'Location Report',
          location: location.name || location.address || `${location.latitude}, ${location.longitude}`,
          latitude: location.latitude,
          longitude: location.longitude,
          notes: `Location-based incident report. ${location.name ? `Location: ${location.name}` : ''} ${location.address ? `Address: ${location.address}` : ''}`,
          status: 'Open',
          timestamp: new Date(parseInt(message.timestamp) * 1000)
        }
      });

      // Link to WhatsApp message
      await prisma.whatsAppMessage.updateMany({
        where: { waId: message.id },
        data: { relatedActivityId: activity.id }
      });

      logSecureInfo('Incident created from WhatsApp location', {
        operation: 'create_incident_from_location'
      }, {
        activityId: activity.id,
        userId: whatsappUser.linkedUser.id,
        hasLocationName: !!location.name,
        hasAddress: !!location.address,
        coordinates: `${location.latitude}, ${location.longitude}`
      });

      return {
        success: true,
        activityId: activity.id,
        activity
      };
    } catch (error) {
      logSecureError('Failed to process location message', {
        operation: 'process_location_message'
      }, error instanceof Error ? error : undefined);

      return {
        success: false,
        error: 'Failed to create incident from location'
      };
    }
  }

  /**
   * Process video message
   */
  private static async processVideoMessage(
    message: WhatsAppInboundMessage,
    whatsappUser: any
  ): Promise<IncidentFromMediaResult> {
    try {
      const videoMedia = message.video;
      if (!videoMedia) {
        return { success: false, error: 'No video data found' };
      }

      // Download video (check size limits)
      const downloadResult = await this.downloadMedia(videoMedia.id, videoMedia.mime_type);
      if (!downloadResult.success) {
        return { success: false, error: downloadResult.error };
      }

      // Create incident report with video
      const activity = await prisma.activity.create({
        data: {
          user_id: whatsappUser.linkedUser.id,
          category_id: await this.getDefaultCategoryId(),
          subcategory: 'Video Report',
          location: 'Location from WhatsApp',
          notes: videoMedia.caption || `Video incident report. File: ${downloadResult.mediaInfo?.filename}`,
          photo_url: downloadResult.localPath,
          status: 'Open',
          timestamp: new Date(parseInt(message.timestamp) * 1000)
        }
      });

      // Link to WhatsApp message
      await prisma.whatsAppMessage.updateMany({
        where: { waId: message.id },
        data: { relatedActivityId: activity.id }
      });

      logSecureInfo('Incident created from WhatsApp video', {
        operation: 'create_incident_from_video'
      }, {
        activityId: activity.id,
        userId: whatsappUser.linkedUser.id,
        hasCaption: !!videoMedia.caption,
        fileSize: downloadResult.mediaInfo?.size
      });

      return {
        success: true,
        activityId: activity.id,
        activity
      };
    } catch (error) {
      logSecureError('Failed to process video message', {
        operation: 'process_video_message'
      }, error instanceof Error ? error : undefined);

      return {
        success: false,
        error: 'Failed to create incident from video'
      };
    }
  }

  /**
   * Process document message
   */
  private static async processDocumentMessage(
    message: WhatsAppInboundMessage,
    whatsappUser: any
  ): Promise<IncidentFromMediaResult> {
    try {
      const documentMedia = message.document;
      if (!documentMedia) {
        return { success: false, error: 'No document data found' };
      }

      // Download document
      const downloadResult = await this.downloadMedia(documentMedia.id, documentMedia.mime_type);
      if (!downloadResult.success) {
        return { success: false, error: downloadResult.error };
      }

      // Create incident report with document
      const activity = await prisma.activity.create({
        data: {
          user_id: whatsappUser.linkedUser.id,
          category_id: await this.getDefaultCategoryId(),
          subcategory: 'Document Report',
          location: 'Location from WhatsApp',
          notes: `Document incident report. File: ${documentMedia.filename || downloadResult.mediaInfo?.filename}`,
          photo_url: downloadResult.localPath,
          status: 'Open',
          timestamp: new Date(parseInt(message.timestamp) * 1000)
        }
      });

      // Link to WhatsApp message
      await prisma.whatsAppMessage.updateMany({
        where: { waId: message.id },
        data: { relatedActivityId: activity.id }
      });

      logSecureInfo('Incident created from WhatsApp document', {
        operation: 'create_incident_from_document'
      }, {
        activityId: activity.id,
        userId: whatsappUser.linkedUser.id,
        filename: documentMedia.filename,
        fileSize: downloadResult.mediaInfo?.size
      });

      return {
        success: true,
        activityId: activity.id,
        activity
      };
    } catch (error) {
      logSecureError('Failed to process document message', {
        operation: 'process_document_message'
      }, error instanceof Error ? error : undefined);

      return {
        success: false,
        error: 'Failed to create incident from document'
      };
    }
  }

  /**
   * Download media file from WhatsApp
   */
  private static async downloadMedia(mediaId: string, mimeType: string): Promise<MediaDownloadResult> {
    try {
      // Validate file type
      if (!this.isAllowedMimeType(mimeType)) {
        return {
          success: false,
          error: `Unsupported file type: ${mimeType}`
        };
      }

      const config = whatsappConfig.getConfig();
      
      // Get media URL
      const mediaInfoResponse = await fetch(
        whatsappConfig.getApiUrl(mediaId),
        {
          method: 'GET',
          headers: whatsappConfig.getApiHeaders()
        }
      );

      if (!mediaInfoResponse.ok) {
        throw new Error(`Failed to get media info: ${mediaInfoResponse.statusText}`);
      }

      const mediaInfo = await mediaInfoResponse.json();
      const mediaUrl = mediaInfo.url;

      // Download the actual file
      const downloadResponse = await fetch(mediaUrl, {
        headers: whatsappConfig.getApiHeaders()
      });

      if (!downloadResponse.ok) {
        throw new Error(`Failed to download media: ${downloadResponse.statusText}`);
      }

      // Check file size
      const contentLength = downloadResponse.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > this.MAX_FILE_SIZE) {
        return {
          success: false,
          error: `File too large: ${contentLength} bytes (max: ${this.MAX_FILE_SIZE})`
        };
      }

      // Create storage directory if it doesn't exist
      await fs.mkdir(this.MEDIA_STORAGE_PATH, { recursive: true });

      // Generate unique filename
      const extension = this.getFileExtension(mimeType);
      const filename = `${mediaId}_${Date.now()}${extension}`;
      const localPath = path.join(this.MEDIA_STORAGE_PATH, filename);

      // Save file
      const buffer = Buffer.from(await downloadResponse.arrayBuffer());
      await fs.writeFile(localPath, buffer);

      // Generate file hash for verification
      const hash = createHash('sha256').update(buffer).digest('hex');

      const fileInfo = {
        filename,
        mimeType,
        size: buffer.length,
        sha256: hash
      };

      logSecureInfo('Media file downloaded successfully', {
        operation: 'download_media'
      }, {
        mediaId,
        filename,
        size: buffer.length,
        mimeType
      });

      return {
        success: true,
        localPath,
        mediaInfo: fileInfo
      };
    } catch (error) {
      logSecureError('Failed to download media', {
        operation: 'download_media'
      }, error instanceof Error ? error : undefined);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed'
      };
    }
  }

  /**
   * Analyze location for context and validation
   */
  private static async analyzeLocation(location: any): Promise<LocationAnalysis> {
    try {
      // Basic validation
      const isValidLocation = this.isValidCoordinates(location.latitude, location.longitude);

      // In a full implementation, you could:
      // - Check against known school locations
      // - Validate coordinates are within expected bounds
      // - Suggest categories based on location type

      return {
        isValidLocation,
        suggestedCategory: location.name?.toLowerCase().includes('maintenance') ? 'Maintenance' : 'General'
      };
    } catch (error) {
      logSecureError('Failed to analyze location', {
        operation: 'analyze_location'
      }, error instanceof Error ? error : undefined);

      return { isValidLocation: false };
    }
  }

  /**
   * Validate coordinates
   */
  private static isValidCoordinates(lat: number, lng: number): boolean {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  /**
   * Check if MIME type is allowed
   */
  private static isAllowedMimeType(mimeType: string): boolean {
    return [
      ...this.ALLOWED_IMAGE_TYPES,
      ...this.ALLOWED_AUDIO_TYPES,
      ...this.ALLOWED_VIDEO_TYPES,
      ...this.ALLOWED_DOCUMENT_TYPES
    ].includes(mimeType);
  }

  /**
   * Get file extension from MIME type
   */
  private static getFileExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'audio/ogg': '.ogg',
      'audio/mpeg': '.mp3',
      'audio/mp4': '.m4a',
      'video/mp4': '.mp4',
      'video/3gpp': '.3gp',
      'application/pdf': '.pdf',
      'text/plain': '.txt'
    };

    return extensions[mimeType] || '.bin';
  }

  /**
   * Get default category ID
   */
  private static async getDefaultCategoryId(): Promise<string> {
    try {
      const category = await prisma.category.findFirst({
        where: { name: 'General' }
      });

      if (category) {
        return category.id;
      }

      // Create default category if it doesn't exist
      const newCategory = await prisma.category.create({
        data: {
          name: 'General',
          isSystem: true
        }
      });

      return newCategory.id;
    } catch (error) {
      logSecureError('Failed to get default category', {
        operation: 'get_default_category'
      }, error instanceof Error ? error : undefined);

      throw new Error('Could not determine category for incident');
    }
  }

  /**
   * Get category based on location analysis
   */
  private static async getLocationBasedCategoryId(analysis: LocationAnalysis): Promise<string> {
    try {
      if (analysis.suggestedCategory) {
        const category = await prisma.category.findFirst({
          where: { name: analysis.suggestedCategory }
        });

        if (category) {
          return category.id;
        }
      }

      return await this.getDefaultCategoryId();
    } catch (error) {
      return await this.getDefaultCategoryId();
    }
  }
}