module.exports = Object.assign({ content: ['./src/**/*.{ts,tsx}'] }, {
            theme: {
                extend: {
                    colors: {
                        calibrex: {
                            navy: 'rgba(26, 42, 74, 1)',
                            teal: '#2a8a9a',
                            gold: '#c9a961',
                            dark: '#050a0f',
                            surface: 'rgba(26, 42, 74, 0.65)',
                            'surface-light': 'rgba(37, 53, 80, 0.45)',
                            critical: '#ff4444',
                            high: '#ff9900',
                            medium: '#ffcc00',
                            low: '#44cc44',
                            muted: '#a8b5c5',
                            text: '#e8eef5'
                        }
                    },
                    fontFamily: {
                        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica Neue', 'sans-serif'],
                        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace']
                    }
                }
            }
        });
