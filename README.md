# eruda-miniapp-plugin

An [Eruda](https://github.com/liriliri/eruda) plugin for debugging [Farcaster mini apps](https://miniapps.farcaster.xyz). The plugin lets you inspect the context, wallet, and actions that the mini app client(eg. Farcaster, Base App, Zapper etc) is sending to your mini app.

## Installation

```bash
# Clone or navigate to the project
cd eruda-miniapp-plugin

# Install dependencies with Bun
bun install

# Build the plugin
bun run build

# Start development server
bun run dev
```

## Usage

1. Add the plugin to your HTML:

```html
<script src="https://cdn.jsdelivr.net/npm/eruda"></script>
<script src="path/to/eruda-miniapp-plugin.js"></script>
<script>
  eruda.init();
  eruda.add(erudaFarcasterMiniappPlugin);
  eruda.show();
</script>
```

### 2. Testing Locally

1. Open `http://localhost:8080` in your browser
2. Click the green Eruda icon to open dev tools
3. Look for the "Mini App" tab
4. Click to inspect SDK data and environment information

### 3. In Production

Include the built plugin file in your Farcaster MiniApp:

```html
<script src="eruda-miniapp-plugin.js"></script>
<script>
  if (typeof eruda !== 'undefined') {
    eruda.add(erudaFarcasterMiniappPlugin);
  }
</script>
```