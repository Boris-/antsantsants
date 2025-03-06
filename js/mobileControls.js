// Mobile Controls System
// Adds touch-friendly controls for mobile devices

// Constants
const JOYSTICK_SIZE = 120; // Size of the joystick in pixels
const JOYSTICK_INNER_SIZE = 60; // Size of the inner circle
const BUTTON_SIZE = 70; // Size of action buttons
const BUTTON_MARGIN = 20; // Margin between buttons

// State
let isMobile = false;
let joystick = {
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    container: null,
    stick: null
};

// Movement values (-1 to 1 range)
let moveX = 0;
let moveY = 0;

// Toggle state for dig/build mode
let inDigMode = true;
let modeToggleButton = null;

// Initialize mobile controls
function initializeMobileControls() {
    // Check if device is mobile
    checkIfMobile();
    
    // Only create controls if on mobile
    if (isMobile) {
        createJoystick();
        createActionButtons();
        
        // Prevent page scrolling on touch
        document.body.addEventListener('touchmove', (e) => {
            if (e.target.classList.contains('mobile-control')) {
                e.preventDefault();
            }
        }, { passive: false });
        
        console.log('Mobile controls initialized');
    }
}

// Check if the device is mobile
function checkIfMobile() {
    isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
               (window.innerWidth <= 800 && window.innerHeight <= 600);
    
    // Add mobile class to body for CSS styling
    if (isMobile) {
        document.body.classList.add('mobile');
    }
    
    return isMobile;
}

// Create virtual joystick
function createJoystick() {
    // Create joystick container
    const container = document.createElement('div');
    container.className = 'joystick-container mobile-control';
    container.style.position = 'fixed';
    container.style.bottom = '100px';
    container.style.left = '100px';
    container.style.width = `${JOYSTICK_SIZE}px`;
    container.style.height = `${JOYSTICK_SIZE}px`;
    container.style.borderRadius = '50%';
    container.style.backgroundColor = 'rgba(100, 100, 100, 0.5)';
    container.style.zIndex = '1000';
    
    // Create joystick stick
    const stick = document.createElement('div');
    stick.className = 'joystick-stick mobile-control';
    stick.style.position = 'absolute';
    stick.style.top = '50%';
    stick.style.left = '50%';
    stick.style.width = `${JOYSTICK_INNER_SIZE}px`;
    stick.style.height = `${JOYSTICK_INNER_SIZE}px`;
    stick.style.marginLeft = `-${JOYSTICK_INNER_SIZE/2}px`;
    stick.style.marginTop = `-${JOYSTICK_INNER_SIZE/2}px`;
    stick.style.borderRadius = '50%';
    stick.style.backgroundColor = 'rgba(200, 200, 200, 0.8)';
    
    // Add stick to container
    container.appendChild(stick);
    
    // Add container to document
    document.body.appendChild(container);
    
    // Store references
    joystick.container = container;
    joystick.stick = stick;
    
    // Set up touch event handlers
    setupJoystickEvents();
}

// Set up joystick event handlers
function setupJoystickEvents() {
    joystick.container.addEventListener('touchstart', handleJoystickStart);
    document.addEventListener('touchmove', handleJoystickMove);
    document.addEventListener('touchend', handleJoystickEnd);
    document.addEventListener('touchcancel', handleJoystickEnd);
}

// Handle joystick touch start
function handleJoystickStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = joystick.container.getBoundingClientRect();
    
    // Center of joystick
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    joystick.active = true;
    joystick.startX = centerX;
    joystick.startY = centerY;
    joystick.currentX = centerX;
    joystick.currentY = centerY;
    
    updateJoystickPosition(touch.clientX, touch.clientY);
}

// Handle joystick movement
function handleJoystickMove(e) {
    if (!joystick.active) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    updateJoystickPosition(touch.clientX, touch.clientY);
}

// Handle joystick release
function handleJoystickEnd(e) {
    if (!joystick.active) return;
    
    joystick.active = false;
    
    // Reset joystick position
    joystick.stick.style.top = '50%';
    joystick.stick.style.left = '50%';
    
    // Reset movement values
    moveX = 0;
    moveY = 0;
    
    // Reset keyboard emulation
    resetMovementKeys();
}

// Update joystick position based on touch
function updateJoystickPosition(touchX, touchY) {
    const rect = joystick.container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Calculate distance from center
    let dx = touchX - centerX;
    let dy = touchY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Limit distance to joystick radius
    const maxDistance = JOYSTICK_SIZE / 2;
    if (distance > maxDistance) {
        dx = dx * maxDistance / distance;
        dy = dy * maxDistance / distance;
    }
    
    // Update joystick position
    const stickX = 50 + (dx / maxDistance * 50);
    const stickY = 50 + (dy / maxDistance * 50);
    joystick.stick.style.left = `${stickX}%`;
    joystick.stick.style.top = `${stickY}%`;
    
    // Calculate movement values (-1 to 1)
    moveX = dx / maxDistance;
    moveY = dy / maxDistance;
    
    // Update keyboard emulation
    updateMovementKeys();
}

// Emulate keyboard input based on joystick position
function updateMovementKeys() {
    // Clear existing movement keys
    resetMovementKeys();
    
    // Set left/right
    if (moveX < -0.3) {
        gameState.keys['ArrowLeft'] = true;
        gameState.keys['KeyA'] = true;
    } else if (moveX > 0.3) {
        gameState.keys['ArrowRight'] = true;
        gameState.keys['KeyD'] = true;
    }
    
    // Set up/down
    if (moveY < -0.3) {
        gameState.keys['ArrowUp'] = true;
        gameState.keys['KeyW'] = true;
        gameState.keys['Space'] = true;
    } else if (moveY > 0.3) {
        gameState.keys['ArrowDown'] = true;
        gameState.keys['KeyS'] = true;
    }
}

// Reset all movement keys
function resetMovementKeys() {
    gameState.keys['ArrowLeft'] = false;
    gameState.keys['ArrowRight'] = false;
    gameState.keys['ArrowUp'] = false;
    gameState.keys['ArrowDown'] = false;
    gameState.keys['KeyW'] = false;
    gameState.keys['KeyA'] = false;
    gameState.keys['KeyS'] = false;
    gameState.keys['KeyD'] = false;
    gameState.keys['Space'] = false;
}

// Create action buttons (mode toggle and place)
function createActionButtons() {
    // Create button container (positioned at bottom right)
    const container = document.createElement('div');
    container.className = 'action-buttons-container';
    container.style.position = 'fixed';
    container.style.bottom = '100px';
    container.style.right = '50px';
    container.style.zIndex = '1000';
    
    // Create mode toggle button
    const toggleButton = document.createElement('div');
    toggleButton.className = 'action-button mode-toggle-button mobile-control';
    toggleButton.style.width = `${BUTTON_SIZE}px`;
    toggleButton.style.height = `${BUTTON_SIZE}px`;
    toggleButton.style.borderRadius = '50%';
    toggleButton.style.backgroundColor = 'rgba(255, 100, 100, 0.7)'; // Start with dig mode color
    toggleButton.style.marginBottom = `${BUTTON_MARGIN}px`;
    toggleButton.style.display = 'flex';
    toggleButton.style.justifyContent = 'center';
    toggleButton.style.alignItems = 'center';
    toggleButton.innerHTML = '<span style="font-size: 24px; color: white;">⛏️</span>'; // Start with dig icon
    
    // Create place button
    const placeButton = document.createElement('div');
    placeButton.className = 'action-button place-button mobile-control';
    placeButton.style.width = `${BUTTON_SIZE}px`;
    placeButton.style.height = `${BUTTON_SIZE}px`;
    placeButton.style.borderRadius = '50%';
    placeButton.style.backgroundColor = 'rgba(100, 255, 100, 0.7)';
    placeButton.style.display = 'flex';
    placeButton.style.justifyContent = 'center';
    placeButton.style.alignItems = 'center';
    placeButton.innerHTML = '<span style="font-size: 24px; color: white;">🧱</span>';
    
    // Add buttons to container
    container.appendChild(toggleButton);
    container.appendChild(placeButton);
    
    // Add container to document
    document.body.appendChild(container);
    
    // Store reference to toggle button
    modeToggleButton = toggleButton;
    
    // Set up event handlers
    setupModeToggleButtonEvents(toggleButton);
    setupButtonEvents(placeButton, handlePlaceButtonPress);
}

// Set up mode toggle button event handlers
function setupModeToggleButtonEvents(button) {
    button.addEventListener('touchstart', (e) => {
        e.preventDefault();
        // Toggle the mode
        inDigMode = !inDigMode;
        
        // Update button appearance based on mode
        if (inDigMode) {
            button.style.backgroundColor = 'rgba(255, 100, 100, 0.7)'; // Dig mode color
            button.innerHTML = '<span style="font-size: 24px; color: white;">⛏️</span>'; // Dig icon
        } else {
            button.style.backgroundColor = 'rgba(100, 100, 255, 0.7)'; // Build mode color
            button.innerHTML = '<span style="font-size: 24px; color: white;">🧱</span>'; // Build icon
        }
    });
}

// Set up button event handlers
function setupButtonEvents(button, handler) {
    button.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handler(true);
    });
    
    button.addEventListener('touchend', (e) => {
        e.preventDefault();
        handler(false);
    });
    
    button.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        handler(false);
    });
}

// Handle dig button press when in dig mode
function handleDigButtonPress(isPressed) {
    // This function remains for compatibility but will be used differently
    // Emulate mouse press for digging
    gameState.mouseDown = isPressed;
    
    if (isPressed) {
        // Generate touch position in the center of the screen for digging
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        
        // Update mouse position
        const rect = gameState.canvas.getBoundingClientRect();
        gameState.mouseX = centerX - rect.left;
        gameState.mouseY = centerY - rect.top;
        
        // Call digging function directly
        if (typeof handleDigging === 'function') {
            handleDigging();
        }
    }
}

// Handle place button
function handlePlaceButtonPress(isPressed) {
    if (isPressed) {
        // Generate touch position in the center of the screen
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        
        // Update mouse position
        const rect = gameState.canvas.getBoundingClientRect();
        gameState.mouseX = centerX - rect.left;
        gameState.mouseY = centerY - rect.top;
        
        // Check the current mode and call the appropriate function
        if (inDigMode) {
            // In dig mode, perform digging
            if (typeof handleDigging === 'function') {
                handleDigging();
            }
        } else {
            // In build mode, perform building
            if (typeof handleBuilding === 'function') {
                handleBuilding();
            }
        }
    }
}

// Expose the mobile detection function
window.isMobileDevice = checkIfMobile;
window.initializeMobileControls = initializeMobileControls; 