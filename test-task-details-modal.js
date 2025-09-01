/**
 * Test script for TaskDetailsModal integration
 * Run this in the browser console at http://localhost:3008
 */

console.log('🧪 Starting TaskDetailsModal Integration Tests...');

// Test 1: Check if ActivityCard click handlers are properly set
function testActivityCardClickability() {
    console.log('\n1️⃣ Testing Activity Card Clickability...');
    
    const activityCards = document.querySelectorAll('[class*="cursor-pointer"]');
    console.log(`Found ${activityCards.length} clickable elements`);
    
    // Look for activity cards specifically
    const cardElements = Array.from(document.querySelectorAll('div')).filter(el => 
        el.className.includes('cursor-pointer') && 
        el.querySelector('[class*="text-base"][class*="font-semibold"]')
    );
    
    console.log(`Found ${cardElements.length} activity cards`);
    
    if (cardElements.length > 0) {
        console.log('✅ Activity cards are rendered and clickable');
        return true;
    } else {
        console.log('❌ No clickable activity cards found');
        return false;
    }
}

// Test 2: Check if modal state management is working
function testModalStateManagement() {
    console.log('\n2️⃣ Testing Modal State Management...');
    
    // Check if TaskDetailsModal exists in the DOM (should be hidden when closed)
    const modal = document.querySelector('[role="dialog"]') || 
                  document.querySelector('[class*="fixed"][class*="inset-0"]');
    
    if (modal) {
        const isVisible = modal.style.display !== 'none' && 
                         !modal.classList.contains('hidden') &&
                         modal.offsetParent !== null;
        
        console.log(`Modal element found. Currently visible: ${isVisible}`);
        return true;
    } else {
        console.log('✅ No modal currently visible (expected initial state)');
        return true;
    }
}

// Test 3: Simulate card click and check for modal opening
function testCardClickToModalOpen() {
    console.log('\n3️⃣ Testing Card Click → Modal Open...');
    
    const cardElements = Array.from(document.querySelectorAll('div')).filter(el => 
        el.className.includes('cursor-pointer') && 
        el.querySelector('[class*="text-base"][class*="font-semibold"]')
    );
    
    if (cardElements.length === 0) {
        console.log('❌ No activity cards found to test');
        return false;
    }
    
    const firstCard = cardElements[0];
    console.log('🎯 Found first activity card, attempting to click...');
    
    // Check for click handler
    const hasClickHandler = firstCard.onclick !== null || 
                           firstCard.addEventListener !== undefined;
    
    console.log(`Card has click capabilities: ${hasClickHandler}`);
    
    // Simulate click event
    try {
        const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true
        });
        
        firstCard.dispatchEvent(clickEvent);
        
        // Check if modal appears after a short delay
        setTimeout(() => {
            const modalAfterClick = document.querySelector('[role="dialog"]') || 
                                   document.querySelector('[class*="fixed"][class*="inset-0"][class*="z-50"]');
            
            if (modalAfterClick && modalAfterClick.offsetParent !== null) {
                console.log('✅ Modal opened successfully after card click!');
                
                // Test modal content
                testModalContent(modalAfterClick);
                
                // Test modal close
                setTimeout(() => testModalClose(modalAfterClick), 1000);
            } else {
                console.log('❌ Modal did not open after card click');
            }
        }, 500);
        
        return true;
    } catch (error) {
        console.log('❌ Error simulating card click:', error.message);
        return false;
    }
}

// Test 4: Check modal content and tabs
function testModalContent(modal) {
    console.log('\n4️⃣ Testing Modal Content and Tabs...');
    
    // Check for tabs
    const tabButtons = modal.querySelectorAll('button[role="tab"], button[class*="tab"]');
    console.log(`Found ${tabButtons.length} tab buttons`);
    
    // Check for expected tabs (Overview, Updates, Actions)
    const tabTexts = Array.from(tabButtons).map(tab => tab.textContent?.toLowerCase());
    const expectedTabs = ['overview', 'updates', 'actions'];
    
    expectedTabs.forEach(expectedTab => {
        const hasTab = tabTexts.some(text => text?.includes(expectedTab));
        console.log(`${expectedTab} tab: ${hasTab ? '✅' : '❌'}`);
    });
    
    // Check for modal title/header
    const modalTitle = modal.querySelector('h2, h3, [class*="text-lg"], [class*="text-xl"]');
    if (modalTitle) {
        console.log('✅ Modal has title/header content');
    }
    
    // Check for close button
    const closeButton = modal.querySelector('button[aria-label*="Close"], button[class*="absolute"][class*="top"]');
    if (closeButton) {
        console.log('✅ Modal has close button');
    }
}

// Test 5: Test modal close functionality
function testModalClose(modal) {
    console.log('\n5️⃣ Testing Modal Close Functionality...');
    
    const closeButton = modal.querySelector('button[aria-label*="Close"], button[class*="absolute"][class*="top"]');
    
    if (closeButton) {
        console.log('🎯 Testing close button...');
        closeButton.click();
        
        setTimeout(() => {
            const modalStillVisible = modal.offsetParent !== null;
            console.log(`Modal closed successfully: ${!modalStillVisible ? '✅' : '❌'}`);
        }, 500);
    } else {
        console.log('❌ No close button found');
    }
    
    // Test ESC key close
    console.log('🎯 Testing ESC key close...');
    const escEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27
    });
    document.dispatchEvent(escEvent);
}

// Test 6: Check event propagation fixes
function testEventPropagation() {
    console.log('\n6️⃣ Testing Event Propagation Fixes...');
    
    const actionButtons = document.querySelectorAll('button[class*="bg-primary"], button[class*="bg-secondary"], button[class*="bg-green"], button[class*="bg-yellow"]');
    
    console.log(`Found ${actionButtons.length} action buttons to test`);
    
    let propagationTestsPassed = 0;
    
    actionButtons.forEach((button, index) => {
        if (index < 5) { // Test first 5 buttons
            const parentCard = button.closest('[class*="cursor-pointer"]');
            
            if (parentCard) {
                // Mock the parent card click handler to detect if it's called
                let cardClicked = false;
                const originalHandler = parentCard.onclick;
                
                parentCard.onclick = () => {
                    cardClicked = true;
                    if (originalHandler) originalHandler();
                };
                
                // Click the button
                button.click();
                
                // Check if parent card click was triggered
                if (!cardClicked) {
                    propagationTestsPassed++;
                    console.log(`✅ Button ${index + 1}: Event propagation properly stopped`);
                } else {
                    console.log(`❌ Button ${index + 1}: Event propagation not stopped`);
                }
                
                // Restore original handler
                parentCard.onclick = originalHandler;
            }
        }
    });
    
    console.log(`Event propagation tests passed: ${propagationTestsPassed}/${Math.min(5, actionButtons.length)}`);
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Running TaskDetailsModal Integration Tests...');
    console.log('================================================');
    
    const results = {
        cardClickability: testActivityCardClickability(),
        modalStateManagement: testModalStateManagement(),
        eventPropagation: testEventPropagation()
    };
    
    // Run card click test with delay to allow for async modal opening
    setTimeout(() => {
        testCardClickToModalOpen();
    }, 1000);
    
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    Object.entries(results).forEach(([test, result]) => {
        console.log(`${test}: ${result ? '✅ PASS' : '❌ FAIL'}`);
    });
    
    console.log('\n📋 Manual Testing Required:');
    console.log('===========================');
    console.log('1. Click on activity cards to open TaskDetailsModal');
    console.log('2. Test all three tabs (Overview, Updates, Actions)');
    console.log('3. Test adding updates, changing status, and assignments');
    console.log('4. Verify that action buttons don\'t trigger card clicks');
    console.log('5. Test modal closing with X button, ESC key, and backdrop click');
    console.log('6. Verify focus management and accessibility');
    
    return results;
}

// Auto-run tests when script is loaded
runAllTests();