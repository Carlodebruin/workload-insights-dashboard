import { prisma } from '../prisma';
import { logSecureInfo, logSecureError, logSecureWarning } from '../secure-logger';
import { generateSecureId } from '../encryption';

/**
 * WhatsApp Phone Number Verification and User Linking Service
 * Handles linking WhatsApp users to existing system users and verification
 */

export interface PhoneVerificationResult {
  success: boolean;
  verificationId?: string;
  linkedUserId?: string;
  isExistingUser?: boolean;
  error?: string;
}

export interface UserLinkingResult {
  success: boolean;
  linkedUser?: any;
  whatsappUser?: any;
  error?: string;
}

export class WhatsAppPhoneVerification {
  private static readonly VERIFICATION_CODE_LENGTH = 6;
  private static readonly VERIFICATION_EXPIRY_MINUTES = 10;

  /**
   * Initiate phone number verification process
   */
  public static async initiateVerification(
    phoneNumber: string,
    whatsappUserId: string
  ): Promise<PhoneVerificationResult> {
    try {
      // Normalize phone number (ensure +27 format for South African numbers)
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
      
      // Check if phone number is already linked to a system user
      const existingUser = await prisma.user.findUnique({
        where: { phone_number: normalizedPhone }
      });

      if (existingUser) {
        // Link WhatsApp user to existing system user
        const linkResult = await this.linkToExistingUser(whatsappUserId, existingUser.id);
        
        if (linkResult.success) {
          logSecureInfo('WhatsApp user linked to existing system user', {
            operation: 'phone_verification'
          }, {
            whatsappUserId,
            linkedUserId: existingUser.id,
            phoneNumber: this.maskPhoneNumber(normalizedPhone)
          });

          return {
            success: true,
            linkedUserId: existingUser.id,
            isExistingUser: true
          };
        } else {
          return {
            success: false,
            error: linkResult.error
          };
        }
      }

      // Generate verification code for new user
      const verificationCode = this.generateVerificationCode();
      const verificationId = generateSecureId();
      const expiresAt = new Date(Date.now() + (this.VERIFICATION_EXPIRY_MINUTES * 60 * 1000));

      // Store verification request
      await prisma.whatsAppConfig.create({
        data: {
          key: `verification_${verificationId}`,
          value: JSON.stringify({
            phoneNumber: normalizedPhone,
            whatsappUserId,
            code: verificationCode,
            expiresAt: expiresAt.toISOString(),
            attempts: 0
          }),
          description: 'Phone verification request',
          isActive: true
        }
      });

      // Send verification code via WhatsApp (implementation depends on messaging service)
      await this.sendVerificationCode(phoneNumber, verificationCode);

      logSecureInfo('Phone verification initiated', {
        operation: 'phone_verification'
      }, {
        verificationId,
        phoneNumber: this.maskPhoneNumber(normalizedPhone),
        whatsappUserId
      });

      return {
        success: true,
        verificationId,
        isExistingUser: false
      };

    } catch (error) {
      logSecureError('Failed to initiate phone verification', {
        operation: 'phone_verification'
      }, error instanceof Error ? error : undefined);

      return {
        success: false,
        error: 'Failed to initiate verification'
      };
    }
  }

  /**
   * Verify phone number with provided code
   */
  public static async verifyPhoneNumber(
    verificationId: string,
    code: string
  ): Promise<PhoneVerificationResult> {
    try {
      // Get verification request
      const verificationConfig = await prisma.whatsAppConfig.findUnique({
        where: { key: `verification_${verificationId}` }
      });

      if (!verificationConfig || !verificationConfig.isActive) {
        return {
          success: false,
          error: 'Invalid verification ID'
        };
      }

      const verificationData = JSON.parse(verificationConfig.value);
      
      // Check if verification has expired
      if (new Date() > new Date(verificationData.expiresAt)) {
        await this.cleanupVerification(verificationId);
        return {
          success: false,
          error: 'Verification code has expired'
        };
      }

      // Check verification code
      if (verificationData.code !== code) {
        // Increment attempt counter
        verificationData.attempts = (verificationData.attempts || 0) + 1;
        
        if (verificationData.attempts >= 3) {
          await this.cleanupVerification(verificationId);
          
          logSecureWarning('Too many verification attempts', {
            operation: 'phone_verification'
          }, {
            verificationId,
            phoneNumber: this.maskPhoneNumber(verificationData.phoneNumber),
            attempts: verificationData.attempts
          });

          return {
            success: false,
            error: 'Too many failed attempts. Please request a new verification code.'
          };
        }

        // Update attempt count
        await prisma.whatsAppConfig.update({
          where: { key: `verification_${verificationId}` },
          data: { value: JSON.stringify(verificationData) }
        });

        return {
          success: false,
          error: 'Invalid verification code'
        };
      }

      // Verification successful - create or link user
      const result = await this.createOrLinkUser(verificationData);
      
      // Cleanup verification data
      await this.cleanupVerification(verificationId);

      logSecureInfo('Phone number verified successfully', {
        operation: 'phone_verification'
      }, {
        verificationId,
        phoneNumber: this.maskPhoneNumber(verificationData.phoneNumber),
        linkedUserId: result.linkedUserId
      });

      return result;

    } catch (error) {
      logSecureError('Failed to verify phone number', {
        operation: 'phone_verification'
      }, error instanceof Error ? error : undefined);

      return {
        success: false,
        error: 'Verification failed'
      };
    }
  }

  /**
   * Link WhatsApp user to existing system user
   */
  private static async linkToExistingUser(
    whatsappUserId: string,
    systemUserId: string
  ): Promise<UserLinkingResult> {
    try {
      const updatedWhatsappUser = await prisma.whatsAppUser.update({
        where: { id: whatsappUserId },
        data: {
          linkedUserId: systemUserId,
          isVerified: true
        },
        include: { linkedUser: true }
      });

      return {
        success: true,
        whatsappUser: updatedWhatsappUser,
        linkedUser: updatedWhatsappUser.linkedUser
      };
    } catch (error) {
      logSecureError('Failed to link WhatsApp user to existing user', {
        operation: 'user_linking'
      }, error instanceof Error ? error : undefined);

      return {
        success: false,
        error: 'Failed to link users'
      };
    }
  }

  /**
   * Create new system user and link to WhatsApp user
   */
  private static async createOrLinkUser(verificationData: any): Promise<PhoneVerificationResult> {
    try {
      // Create new system user
      const newUser = await prisma.user.create({
        data: {
          phone_number: verificationData.phoneNumber,
          name: 'WhatsApp User', // Will be updated when user provides name
          role: 'Teacher' // Default role, can be changed by admin
        }
      });

      // Link WhatsApp user to new system user
      const updatedWhatsappUser = await prisma.whatsAppUser.update({
        where: { id: verificationData.whatsappUserId },
        data: {
          linkedUserId: newUser.id,
          isVerified: true
        }
      });

      logSecureInfo('New system user created and linked to WhatsApp', {
        operation: 'user_creation'
      }, {
        newUserId: newUser.id,
        whatsappUserId: verificationData.whatsappUserId,
        phoneNumber: this.maskPhoneNumber(verificationData.phoneNumber)
      });

      return {
        success: true,
        linkedUserId: newUser.id,
        isExistingUser: false
      };
    } catch (error) {
      logSecureError('Failed to create or link user', {
        operation: 'user_creation'
      }, error instanceof Error ? error : undefined);

      return {
        success: false,
        error: 'Failed to create user account'
      };
    }
  }

  /**
   * Send verification code via WhatsApp
   */
  private static async sendVerificationCode(phoneNumber: string, code: string): Promise<void> {
    // This will be implemented with the messaging service
    // For now, log the code (in production, this should be sent via WhatsApp)
    logSecureInfo('Verification code generated', {
      operation: 'send_verification'
    }, {
      phoneNumber: this.maskPhoneNumber(phoneNumber),
      // Don't log the actual code in production
      codeGenerated: true
    });
  }

  /**
   * Cleanup verification data
   */
  private static async cleanupVerification(verificationId: string): Promise<void> {
    try {
      await prisma.whatsAppConfig.delete({
        where: { key: `verification_${verificationId}` }
      });
    } catch (error) {
      logSecureError('Failed to cleanup verification data', {
        operation: 'cleanup_verification'
      }, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Generate random verification code
   */
  private static generateVerificationCode(): string {
    const min = Math.pow(10, this.VERIFICATION_CODE_LENGTH - 1);
    const max = Math.pow(10, this.VERIFICATION_CODE_LENGTH) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  /**
   * Normalize phone number to standard format
   */
  private static normalizePhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Handle South African numbers
    if (cleaned.startsWith('27')) {
      cleaned = '+' + cleaned;
    } else if (cleaned.startsWith('0') && cleaned.length === 10) {
      // Convert local format (0XX XXX XXXX) to international (+27XX XXX XXXX)
      cleaned = '+27' + cleaned.substring(1);
    } else if (cleaned.length === 9) {
      // Assume it's missing the +27 prefix
      cleaned = '+27' + cleaned;
    } else if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }

    return cleaned;
  }

  /**
   * Mask phone number for logging
   */
  private static maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length < 4) return '****';
    return phoneNumber.slice(0, -4).replace(/./g, '*') + phoneNumber.slice(-4);
  }

  /**
   * Get user linking status
   */
  public static async getUserLinkingStatus(phoneNumber: string): Promise<{
    isLinked: boolean;
    whatsappUser?: any;
    systemUser?: any;
  }> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
      
      const whatsappUser = await prisma.whatsAppUser.findUnique({
        where: { phoneNumber: normalizedPhone },
        include: { linkedUser: true }
      });

      return {
        isLinked: !!(whatsappUser?.linkedUser),
        whatsappUser,
        systemUser: whatsappUser?.linkedUser
      };
    } catch (error) {
      logSecureError('Failed to get user linking status', {
        operation: 'get_linking_status'
      }, error instanceof Error ? error : undefined);

      return { isLinked: false };
    }
  }

  /**
   * Unlink WhatsApp user from system user
   */
  public static async unlinkUser(whatsappUserId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await prisma.whatsAppUser.update({
        where: { id: whatsappUserId },
        data: {
          linkedUserId: null,
          isVerified: false
        }
      });

      logSecureInfo('WhatsApp user unlinked from system user', {
        operation: 'unlink_user'
      }, { whatsappUserId });

      return { success: true };
    } catch (error) {
      logSecureError('Failed to unlink WhatsApp user', {
        operation: 'unlink_user'
      }, error instanceof Error ? error : undefined);

      return {
        success: false,
        error: 'Failed to unlink user'
      };
    }
  }
}