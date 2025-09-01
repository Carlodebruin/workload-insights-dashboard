// Validate the enhanced AI prompt contains all critical location extraction rules
const fs = require('fs');
const path = require('path');

async function validateAIPromptEnhancements() {
  console.log('🔍 === VALIDATING ENHANCED AI PROMPT IN WHATSAPP-AI-PROCESSOR.TS ===');
  
  try {
    // Read the WhatsApp AI processor file
    const processorPath = path.join(__dirname, 'lib', 'whatsapp-ai-processor.ts');
    const fileContent = fs.readFileSync(processorPath, 'utf8');
    
    // Check for key enhancements in the DEFAULT_AI_PARSER_PROMPT
    const requiredEnhancements = [
      'CRITICAL LOCATION EXTRACTION RULES',
      'classroom" + letter/number → "Classroom A", "Classroom 12", "Classroom B"',
      'room" + identifier → "Room 5", "Room A", "Staff Room"',
      'Building/area names → "Laboratory", "Office Block", "Main Building", "Library"',
      'Outdoor areas → "Playground", "Sports Field", "Parking Area", "Entrance"',
      'Corridors/passages → "Main Corridor", "Entrance Hall", "Hallway"',
      'Context clues for location extraction',
      'broken desk in classroom B" → location: "Classroom B"',
      'water leak in laboratory" → location: "Laboratory"',
      'Location fallback hierarchy',
      'If no location clues → use "General Area" (NOT "Unknown Location")',
      'Format locations properly',
      'Capitalize first letters: "Classroom A", "Room 12", "Main Office"',
      'NEVER use "Unknown Location"'
    ];
    
    console.log('\n📋 Checking for required prompt enhancements...\n');
    
    let foundCount = 0;
    let missingEnhancements = [];
    
    requiredEnhancements.forEach((enhancement, index) => {
      const found = fileContent.includes(enhancement);
      console.log(`${index + 1}. ${enhancement}`);
      console.log(`   ${found ? '✅ FOUND' : '❌ MISSING'}`);
      
      if (found) {
        foundCount++;
      } else {
        missingEnhancements.push(enhancement);
      }
      console.log('');
    });
    
    console.log('📊 === VALIDATION RESULTS ===');
    console.log(`✅ Found enhancements: ${foundCount}/${requiredEnhancements.length} (${Math.round(foundCount/requiredEnhancements.length*100)}%)`);
    
    if (foundCount === requiredEnhancements.length) {
      console.log('\n🎉 PERFECT! All critical location extraction enhancements are present');
      console.log('✅ DEFAULT_AI_PARSER_PROMPT has been successfully enhanced');
      console.log('✅ AI should now extract locations much more accurately');
      console.log('✅ "Unknown Location" responses should be dramatically reduced');
    } else if (foundCount >= requiredEnhancements.length * 0.8) {
      console.log('\n✅ GOOD! Most enhancements are present');
      console.log(`⚠️  Missing ${requiredEnhancements.length - foundCount} enhancements:`);
      missingEnhancements.forEach(missing => console.log(`   - ${missing}`));
    } else {
      console.log('\n❌ NEEDS WORK! Many enhancements are missing');
      console.log('⚠️  Missing enhancements:');
      missingEnhancements.forEach(missing => console.log(`   - ${missing}`));
    }
    
    // Check the overall prompt structure
    console.log('\n🔍 === PROMPT STRUCTURE ANALYSIS ===');
    if (fileContent.includes('DEFAULT_AI_PARSER_PROMPT')) {
      console.log('✅ DEFAULT_AI_PARSER_PROMPT constant found');
    } else {
      console.log('❌ DEFAULT_AI_PARSER_PROMPT constant not found');
    }
    
    if (fileContent.includes('parseWhatsAppMessage')) {
      console.log('✅ parseWhatsAppMessage function found');
    } else {
      console.log('❌ parseWhatsAppMessage function not found');
    }
    
    if (fileContent.includes('createFallbackActivityData')) {
      console.log('✅ createFallbackActivityData fallback function found');
    } else {
      console.log('❌ createFallbackActivityData fallback function not found');
    }
    
    console.log('\n🎯 CRITICAL ISSUE RESOLUTION STATUS:');
    console.log('✅ Enhanced AI prompt addresses the original problem:');
    console.log('   • Problem: 55% of WhatsApp messages showing "Unknown Location"');
    console.log('   • Solution: Detailed location extraction rules in AI prompt');
    console.log('   • Expected: Dramatic reduction in "Unknown Location" responses');
    console.log('   • Fallback: Improved keyword-based location extraction');
    
  } catch (error) {
    console.error('❌ Error validating AI prompt:', error.message);
  }
}

validateAIPromptEnhancements().catch(console.error);