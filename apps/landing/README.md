# PayloadX Landing Page

A modern, responsive landing page for PayloadX built with React Vite.

## Features

- 🚀 Built with React 18 and Vite for fast development
- 🎨 Beautiful, modern design with CSS modules
- 📱 Fully responsive design
- 🌙 Dark theme with gradient accents
- ⚡ Optimized performance with lazy loading
- 🔗 GitHub releases API integration for download links
- 🎯 Animated orbital tech showcase

## Getting Started

### Prerequisites

- Node.js 16+ 
- npm or yarn

### Installation

1. Clone the repository
2. Navigate to the landing page directory:
   ```bash
   cd apps/landing
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Building for Production

Build the optimized production version:
```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build

Preview the production build locally:
```bash
npm run preview
```

## Project Structure

```
apps/landing/
├── public/
│   └── logo.png              # App logo
├── src/
│   ├── App.jsx               # Main landing page component
│   ├── App.module.css        # Component styles
│   ├── main.jsx              # App entry point
│   └── index.css             # Global styles
├── index.html                # HTML template
├── package.json              # Dependencies and scripts
├── vite.config.js            # Vite configuration
└── README.md                 # This file
```

## Technologies Used

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **CSS Modules** - Scoped styling
- **Lucide React** - Icon library
- **React Icons** - Additional icons (Apple, Windows, Linux)

## Customization

### Colors and Theme

The color scheme is defined in `src/App.module.css`. Main colors:
- Background: `#0f0f0f`
- Primary accent: `#38bdf8` (blue)
- Text: `#f1f5f9` (light)
- Secondary text: `#94a3b8`

### Download Links

The download links are automatically fetched from the GitHub releases API. To update:
1. Change the repository in the fetch URL
2. Update the `BASE_DOWNLOADS` array for different platforms

### Tech Stack Icons

Add or remove technologies in the `TECH_STRIP` and `ORBIT_ICONS` arrays in `App.jsx`.

## Deployment

### Static Hosting

The build output is static and can be deployed to any static hosting service:
- Netlify
- Vercel
- GitHub Pages
- AWS S3

### Build Configuration

The `vite.config.js` includes:
- Base path configuration
- Output directory settings
- Development server settings
- Source map generation

## Contributing

1. Make your changes
2. Test locally with `npm run dev`
3. Build with `npm run build`
4. Submit a pull request

## License

This project is open source and available under the [MIT License](../../LICENSE).
