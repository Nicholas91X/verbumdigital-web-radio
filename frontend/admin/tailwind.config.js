/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#f0f5ff',
                    100: '#e0eaff',
                    200: '#c7d7fe',
                    300: '#a4bcfd',
                    400: '#7c9cf9',
                    500: '#5b7bf3',
                    600: '#4059e7',
                    700: '#3346d3',
                    800: '#2c3aab',
                    900: '#2a3587',
                    950: '#1c2152',
                },
                surface: {
                    50: '#f8fafc',
                    100: '#f1f5f9',
                    200: '#e2e8f0',
                    300: '#cbd5e1',
                    400: '#94a3b8',
                    500: '#64748b',
                    600: '#475569',
                    700: '#334155',
                    800: '#1e293b',
                    900: '#0f172a',
                    950: '#020617',
                },
            },
        },
    },
    plugins: [],
}
