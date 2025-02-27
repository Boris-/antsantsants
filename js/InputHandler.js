export class InputHandler {
    constructor() {
        this.keys = {
            left: false,
            right: false,
            up: false,
            down: false,
            dig: false,
            interact: false
        };

        // Bind event handlers
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    handleKeyDown(event) {
        switch (event.key.toLowerCase()) {
            case 'arrowleft':
            case 'a':
                this.keys.left = true;
                break;
            case 'arrowright':
            case 'd':
                this.keys.right = true;
                break;
            case 'arrowup':
            case 'w':
                this.keys.up = true;
                break;
            case 'arrowdown':
            case 's':
                this.keys.down = true;
                break;
            case ' ':
                this.keys.dig = true;
                event.preventDefault(); // Prevent page scrolling
                break;
            case 'e':
                this.keys.interact = true;
                break;
        }
    }

    handleKeyUp(event) {
        switch (event.key.toLowerCase()) {
            case 'arrowleft':
            case 'a':
                this.keys.left = false;
                break;
            case 'arrowright':
            case 'd':
                this.keys.right = false;
                break;
            case 'arrowup':
            case 'w':
                this.keys.up = false;
                break;
            case 'arrowdown':
            case 's':
                this.keys.down = false;
                break;
            case ' ':
                this.keys.dig = false;
                break;
            case 'e':
                this.keys.interact = false;
                break;
        }
    }

    getInput() {
        return { ...this.keys };
    }
} 