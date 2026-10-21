module.exports = Object.assign({ content: ['./client/src/**/*.{ts,tsx}', './client/index.html'] }, {
            theme: {
                extend: {
                    colors: {
                        calibrex: {
                            navy: 'rgba(26, 42, 74, 1)',
                            teal: '#2a8a9a',
                            gold: '#e9bd78',
                            saffron: '#f5a944',
                            dark: '#050a0f',
                            surface: 'rgba(26, 42, 74, 0.65)',
                            'surface-light': 'rgba(37, 53, 80, 0.45)',
                            critical: '#ff4444',
                            high: '#ff9900',
                            medium: '#ffcc00',
                            low: '#44cc44',
                            muted: '#a8b5c5',
                            text: '#f2f5fb'
                        }
                    },
                    fontFamily: {
                        sans: ['Manrope', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica Neue', 'sans-serif'],
                        mono: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
                        display: ['Michroma', 'Manrope', 'sans-serif'],
                        serif: ['"Playfair Display"', 'Georgia', 'serif']
                    }
                }
            }
        });
