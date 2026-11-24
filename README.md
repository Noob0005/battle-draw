# Battle Draw

Paint armies, then watch them brawl. A canvas sandbox battler with no dependencies.

## Run

```
npm start
```

Open http://localhost:3000. Change the port with `PORT=8080 npm start`.

## Controls

- Drag to paint. Right-drag or press E to erase. Scroll to resize the brush.
- Space: start or pause · C: clear · Ctrl+Z: undo · 1–9: pick a unit · Tab: next category · M: mute

## Layout

- `server.js`: static file server built on Node's `http` module
- `public/js/units.js`: unit stats
- `public/js/sim.js`: battle rules and unit AI (no DOM)
- `public/js/art.js`: character drawings
- `public/js/render.js`: canvas drawing
- `public/js/main.js`: UI, input, sound, game loop
- `public/styles.css`: interface styling
