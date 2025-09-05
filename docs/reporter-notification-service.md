# Reporter Notification Service

## Overview

The Reporter Notification Service provides automated WhatsApp notifications to reporters when their tasks are assigned, completed, or have status updates. This service works alongside the existing staff notification infrastructure without modifying existing WhatsApp flows.

## Key Features

- **Assignment Notifications**: Notify reporters when their tasks are assigned to staff
- **Completion Notifications**: Inform reporters when their tasks are completed
- **Status Updates**: Send updates when task status changes
- **Backward Compatibility**: Works alongside existing staff notification system
- **Secure Logging**: PII-protected logging with GDPR/POPIA compliance

## API Functions

### `notifyReporterOfAssignment(activityId, assignedUserId, options)`

Notifies the reporter when their task is assigned to staff.

**Parameters:**
- `activityId` (string): The ID of the activity/task
- `assignedUserId` (string): ID of the user making the assignment
- `options` (ReporterNotificationOptions): Optional configuration

**Returns:** `Promise<ReporterNotificationResult>`

### `notifyReporterOfCompletion(activityId, completedByUserId, resolutionNotes)`

Notifies the reporter when their task is completed.

**Parameters:**
- `activityId` (string): The ID of the completed activity
- `completedByUserId` (string): ID of the user who completed the task
- `resolutionNotes` (string): Optional resolution details

**Returns:** `Promise<ReporterNotificationResult>`

### `notifyReporterOfStatusUpdate(activityId, updatedByUserId, updateNotes, status)`

Notifies the reporter of task status updates.

**Parameters:**
- `activityId` (string): The ID of the activity
- `updatedByUserId` (string): ID of the user making the update
- `updateNotes` (string): Details about the status update
- `status` (string): New status of the task

**Returns:** `Promise<ReporterNotificationResult>`

## Integration Points

### Activity Assignment Flow
```typescript
// After successfully assigning staff to an activity
const staffResult = await notifyStaffOfAssignment(activityId, assignedUserId);
const reporterResult = await notifyReporterOfAssignment(activityId, assignedUserId);
```

### Activity Completion Flow
```typescript
// After marking an activity as completed
const staffResult = await notifyStaffOfCompletion(activityId, completedByUserId, resolutionNotes);
const reporterResult = await notifyReporterOfCompletion(activityId, completedByUserId, resolutionNotes);
```

### Status Update Flow
```typescript
// When updating activity status
const reporterResult = await notifyReporterOfStatusUpdate(
  activityId, 
  updatedByUserId, 
  updateNotes, 
  newStatus
);
```

## Message Templates

### Assignment Notification
```
✅ *Your Task Has Been Assigned*

📋 **Reference:** CATEG-1234
🏷️ **Task:** Pothole Repair
📍 **Location:** Main Street
⏰ **Submitted:** 2025-09-04 10:30 AM

👤 **Assigned To:** John Smith
🎯 **Role:** Road Maintenance Specialist

🎯 **Status:** Your task has been assigned to our team and is now being worked on.

📞 **Need to Update?**
• Reply to this message with any additional details
• We'll keep you updated on progress
• Contact us if you have urgent questions

Thank you for your patience!
```

### Completion Notification
```
✅ *Task Completed: CATEG-1234*

🏷️ **Task:** Pothole Repair
📍 **Location:** Main Street
⏰ **Completed:** 2025-09-04 2:45 PM

💡 **Resolution:** Pothole filled and sealed with asphalt. Area marked for 24-hour curing.

🎉 **Thank you!** Your issue has been resolved.

📞 Need further assistance? Reply to this message.
```

### Status Update Notification
```
📋 *Task Update: CATEG-1234*

🏷️ **Task:** Pothole Repair
📍 **Location:** Main Street
📊 **Status:** In Progress
⏰ **Updated:** 2025-09-04 1:15 PM

💬 **Update:** Crew has arrived on site and is preparing materials for repair.

We'll keep you informed of further progress.
```

## Error Handling

The service includes comprehensive error handling:

1. **Activity Not Found**: Returns error if activity doesn't exist
2. **Invalid WhatsApp Number**: Skips notification if reporter has no valid WhatsApp contact
3. **Message Send Failures**: Handles WhatsApp API failures gracefully
4. **Database Errors**: Properly handles database connection issues

## Security & Compliance

- All notifications use PII-redacted logging
- Phone numbers are validated and formatted before use
- No sensitive information is logged or exposed
- GDPR/POPIA compliant logging practices

## Testing

Run the test script to verify functionality:
```bash
node scripts/test-reporter-notification.js
```

## Dependencies

- `lib/whatsapp/messaging-service`: WhatsApp message delivery
- `lib/secure-logger`: Secure, compliant logging
- `lib/db-wrapper`: Database operations with retry logic
- `lib/staff-notification-service`: Phone number validation utilities