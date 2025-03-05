// Background Music System
class BackgroundMusic {
    constructor() {
        this.tracks = {
            booklofi: new Audio('/booklofi.mp3'),
            moveonlofi: new Audio('/moveonlofi.mp3')
        };
        
        // Configure audio tracks
        Object.values(this.tracks).forEach(track => {
            track.loop = true;
            track.volume = 0.2; // Lower volume for background music
        });
        
        this.currentTrack = null;
        this.isPlaying = false;
        this.isMuted = false;
        
        // Set default track
        this.currentTrack = this.tracks.booklofi;
    }
    
    play(trackName) {
        // Stop current track if any is playing
        if (this.isPlaying && this.currentTrack) {
            this.currentTrack.pause();
        }
        
        // Set and play the new track
        if (trackName && this.tracks[trackName]) {
            this.currentTrack = this.tracks[trackName];
        }
        
        if (this.currentTrack && !this.isMuted) {
            // Set current time to 0 to restart if it was already played
            this.currentTrack.currentTime = 0;
            
            // Use a promise to handle potential autoplay restrictions
            const playPromise = this.currentTrack.play();
            
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.log('Music playback was prevented by the browser:', error);
                    // We'll add UI to inform the user they need to interact first
                });
            }
            
            this.isPlaying = true;
        }
    }
    
    pause() {
        if (this.currentTrack) {
            this.currentTrack.pause();
            this.isPlaying = false;
        }
    }
    
    toggle() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }
    
    switchTrack() {
        // Switch between the two tracks
        if (this.currentTrack === this.tracks.booklofi) {
            this.play('moveonlofi');
        } else {
            this.play('booklofi');
        }
    }
    
    mute() {
        this.isMuted = true;
        if (this.currentTrack) {
            this.currentTrack.volume = 0;
        }
    }
    
    unmute() {
        this.isMuted = false;
        if (this.currentTrack) {
            this.currentTrack.volume = 0.2;
        }
    }
    
    toggleMute() {
        if (this.isMuted) {
            this.unmute();
        } else {
            this.mute();
        }
    }
}

// Create a global music player
window.backgroundMusic = null;

// Initialize background music
function initBackgroundMusic() {
    window.backgroundMusic = new BackgroundMusic();
    
    // Create music controls
    createMusicControls();
    
    // Start music on first user interaction to get around autoplay restrictions
    const startMusicOnInteraction = () => {
        if (window.backgroundMusic) {
            window.backgroundMusic.play();
            
            // Remove event listeners after first interaction
            document.removeEventListener('click', startMusicOnInteraction);
            document.removeEventListener('keydown', startMusicOnInteraction);
            
            console.log('Background music started on user interaction');
        }
    };
    
    // Add event listeners for user interaction
    document.addEventListener('click', startMusicOnInteraction);
    document.addEventListener('keydown', startMusicOnInteraction);
}

// Create music control buttons
function createMusicControls() {
    // Create a container for music controls
    const controlsContainer = document.createElement('div');
    controlsContainer.id = 'music-controls';
    controlsContainer.style.position = 'fixed';
    controlsContainer.style.top = '10px';
    controlsContainer.style.left = '10px';
    controlsContainer.style.zIndex = '1000';
    
    // Create toggle button
    const toggleButton = document.createElement('button');
    toggleButton.textContent = '🎵';
    toggleButton.title = 'Toggle Music';
    toggleButton.style.marginRight = '5px';
    toggleButton.style.padding = '5px 10px';
    toggleButton.style.background = 'rgba(0, 0, 0, 0.5)';
    toggleButton.style.color = 'white';
    toggleButton.style.border = 'none';
    toggleButton.style.borderRadius = '3px';
    toggleButton.style.cursor = 'pointer';
    
    // Create switch track button
    const switchButton = document.createElement('button');
    switchButton.textContent = '↻';
    switchButton.title = 'Switch Track';
    switchButton.style.padding = '5px 10px';
    switchButton.style.background = 'rgba(0, 0, 0, 0.5)';
    switchButton.style.color = 'white';
    switchButton.style.border = 'none';
    switchButton.style.borderRadius = '3px';
    switchButton.style.cursor = 'pointer';
    
    // Add event listeners
    toggleButton.addEventListener('click', () => {
        window.backgroundMusic.toggleMute();
        toggleButton.textContent = window.backgroundMusic.isMuted ? '🔇' : '🎵';
    });
    
    switchButton.addEventListener('click', () => {
        window.backgroundMusic.switchTrack();
    });
    
    // Add buttons to container
    controlsContainer.appendChild(toggleButton);
    controlsContainer.appendChild(switchButton);
    
    // Add container to body
    document.body.appendChild(controlsContainer);
}

// Export functions
window.initBackgroundMusic = initBackgroundMusic; 