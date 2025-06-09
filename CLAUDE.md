# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Development:**

- `pnpm dev` - Start Vite development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build

**Code Quality:**

- `pnpm lint` - Run ESLint on TypeScript/JavaScript files
- `pnpm lint:fix` - Auto-fix ESLint issues

## Project Architecture

**OpenCyberDance** is an interactive 3D cybernetic dance application built with Three.js, Vue 3, and TypeScript. The system features real-time character animation control, voice recognition, and sophisticated parameter manipulation for dance performances.

### Core Systems

**World Management (`src/world.ts`):**

- Central `World` class manages the entire 3D scene, cameras, lighting, and characters
- Handles scene transitions between 'BLACK' (dance mode) and 'ENDING' (multi-character finale)
- Uses OrthographicCamera with preset configurations for different viewing angles
- Manages fade transitions, shadow effects, and dissolution effects for theatrical presentation

**Character System (`src/character.ts`):**

- `Character` class handles 3D model loading, animation mixing, and parameter modifications
- Supports multiple dance models (waiting, kukpat, poon, changhung, yokrob, etc.)
- Real-time keyframe manipulation for energy, delays, curves, and rotation overrides
- External Body Space (EBS) system for sophisticated timing modifications
- Bone rotation system for real-time posture control during animations

**Animation Control:**

- Original keyframe data is cached and dynamically modified rather than pre-computed
- Parameters like energy, delays, curves affect timing and movement in real-time
- Cross-fade system for smooth transitions between modified animations
- Axis point control allows freezing character poses at specific moments

**State Management (`src/store/`):**

- Uses nanostores for reactive state management
- Scene transitions, debug settings, and animation status tracked globally
- Vue components react to store changes for UI updates

**Voice Recognition (`src/voice.ts`):**

- Integrated voice control system for user interaction
- Prompts and commands processed through speech recognition
- Timeout management for voice prompt sessions

### Key Features

**Interactive Controls:**

- Spacebar/PageDown/Right Arrow: Toggle voice prompts
- Ctrl+E: Switch between dance and ending scenes
- Ctrl+U: Start shadow character mode
- Ctrl+I: Start dissolution effects
- Ctrl+F: Fullscreen toggle
- G: Toggle debug panel
- C: Enable camera controls

**Parameter System:**

- Real-time modification of dance animations through curve equations
- Energy-based timing adjustments for different body parts
- Position locking and rotation overrides
- External body space calculations for complex movement patterns

**Asset Pipeline:**

- GLTF models loaded via preloader system
- Multiple character models with corresponding animation tracks
- Audio assets (traditional Thai music and sound effects)
- Font assets for UI rendering

The application is designed for kiosk/installation use with keyboard shortcuts for scene control and voice interaction for user participation in the dance experience.

**Deprecated Modules:**

- IK module is deprecated and will be removed in the future. It is superseded by `bone-rotation.ts` and `postures.ts` which are ported from the HTML prototype in `references/axis-point-prototype.html`
