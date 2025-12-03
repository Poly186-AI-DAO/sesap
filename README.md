# SESAP Template Playground

The SESAP Template Playground is a web-based tool for designing, testing, and generating Smart Social Contracts using the Accord Project technology stack. It allows users to edit templates, models, and data, and preview the generated agreements in real-time.

## Features

- **Template Editor**: Edit markdown templates with embedded variables and logic.
- **Model Editor**: Define data models using Concerto (CTO).
- **Data Editor**: Input JSON data to test the template.
- **Real-time Preview**: See the generated agreement HTML instantly.
- **SESAP Integration**: Customized for SESAP Smart Social Contracts.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm (v6 or higher)

### Installation

1. Clone the repository (if you haven't already).
2. Install dependencies:

```bash
npm install
```

### Running the Application

Start the development server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) (or the port shown in your terminal) to view the playground.

### Building for Production

To build the application for production:

```bash
npm run build
```

The output will be in the `dist` directory.

## Troubleshooting

If you encounter a blank page on startup:
1. Ensure you are using a compatible Node.js version.
2. Check the console for any errors.
3. If you see issues with `core-js` or `regenerator-runtime`, they have been disabled in `src/main.tsx` to prevent conflicts with Vite polyfills.

## License

[License Information]
