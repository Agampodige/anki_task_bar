/**
 * Hot Reload Utility for Anki Taskbar Development
 * 
 * This script provides hot reload functionality for development.
 * It monitors for changes and automatically refreshes the page.
 */

class HotReload {
    constructor() {
        this.isEnabled = false;
        this.socket = null;
        this.checkInterval = null;
        this.lastModified = {};
        
        // Only enable in development mode
        this.isDevelopment = this.detectDevelopmentMode();
        
        if (this.isDevelopment) {
            this.init();
        }
    }
    
    detectDevelopmentMode() {
        // Check if we're in development mode
        return window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1' ||
               window.location.protocol === 'file:' ||
               window.ankiTaskBarSettings?.development === true;
    }
    
    init() {
        console.log('🔥 Hot Reload: Development mode detected');
        
        // Add hot reload indicator
        this.addIndicator();
        
        // Start monitoring
        this.startMonitoring();
        
        // Add keyboard shortcut to toggle hot reload
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') {
                e.preventDefault();
                this.toggle();
            }
        });
        
        // Add console commands
        window.hotReload = this;
        console.log('🔥 Hot Reload: Available commands:');
        console.log('  - hotReload.enable()');
        console.log('  - hotReload.disable()');
        console.log('  - hotReload.toggle()');
        console.log('  - hotReload.reload()');
        console.log('  - Ctrl+Shift+H to toggle');
    }
    
    addIndicator() {
        // Add a small indicator to show hot reload status
        const indicator = document.createElement('div');
        indicator.id = 'hot-reload-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(76, 175, 80, 0.9);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-family: monospace;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s;
            pointer-events: none;
        `;
        indicator.textContent = '🔥 HOT';
        document.body.appendChild(indicator);
        
        // Show briefly on load
        setTimeout(() => {
            indicator.style.opacity = '0.7';
            setTimeout(() => {
                indicator.style.opacity = '0';
            }, 2000);
        }, 500);
    }
    
    updateIndicator(show) {
        const indicator = document.getElementById('hot-reload-indicator');
        if (indicator) {
            indicator.style.opacity = show ? '0.7' : '0';
        }
    }
    
    startMonitoring() {
        if (!this.isDevelopment) return;
        
        this.isEnabled = true;
        this.updateIndicator(true);
        
        // Use Python bridge for file monitoring if available
        if (window.py && window.py.enable_hot_reload) {
            try {
                window.py.enable_hot_reload();
                console.log('🔥 Hot Reload: Enabled via Python bridge');
                return;
            } catch (e) {
                console.warn('🔥 Hot Reload: Python bridge not available, using fallback');
            }
        }
        
        // Fallback: Check for file changes via HTTP HEAD requests
        this.checkInterval = setInterval(() => {
            this.checkForChanges();
        }, 1000);
        
        console.log('🔥 Hot Reload: Started monitoring');
    }
    
    async checkForChanges() {
        if (!this.isEnabled) return;
        
        // Get all script and link tags
        const resources = [
            ...document.querySelectorAll('script[src]'),
            ...document.querySelectorAll('link[rel="stylesheet"]')
        ];
        
        for (const resource of resources) {
            const url = resource.src || resource.href;
            if (!url || url.startsWith('data:')) continue;
            
            try {
                const response = await fetch(url, { method: 'HEAD' });
                const lastModified = response.headers.get('last-modified');
                
                if (lastModified && this.lastModified[url] !== lastModified) {
                    this.lastModified[url] = lastModified;
                    this.reload();
                    break;
                } else if (lastModified) {
                    this.lastModified[url] = lastModified;
                }
            } catch (e) {
                // Ignore errors for local files
            }
        }
    }
    
    reload() {
        if (!this.isEnabled) return;
        
        console.log('🔥 Hot Reload: Reloading page...');
        
        // Show indicator
        this.updateIndicator(true);
        
        // Reload the page
        window.location.reload();
    }
    
    enable() {
        if (this.isEnabled) return;
        this.startMonitoring();
    }
    
    disable() {
        if (!this.isEnabled) return;
        
        this.isEnabled = false;
        this.updateIndicator(false);
        
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        
        if (window.py && window.py.disable_hot_reload) {
            try {
                window.py.disable_hot_reload();
            } catch (e) {
                // Ignore
            }
        }
        
        console.log('🔥 Hot Reload: Disabled');
    }
    
    toggle() {
        if (this.isEnabled) {
            this.disable();
        } else {
            this.enable();
        }
    }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new HotReload();
    });
} else {
    new HotReload();
}
